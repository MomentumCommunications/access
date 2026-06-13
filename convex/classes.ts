import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import {
  compareClassesBySchedule,
  compareRowsByClassSchedule,
} from "./lib/classSorting";
import { calculateAgeOnDate, classMatchesAge } from "./lib/age";
import {
  isDateBetween,
  syncAllGeneratedSessions,
  syncGeneratedSessionsForClass,
  todayValue,
} from "./lib/scheduling";
import {
  hasUserRole,
  highestUserRole,
  normalizeUserRoles,
  resolveUserRoles,
  type UserRole,
} from "./lib/roles";
import {
  resolveEnrollmentStatusDates,
  validateEnrollmentDates,
} from "./lib/enrollmentValidation";
import { getCurrentUser, getCurrentUserOrThrow } from "./users";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("staff"),
  v.literal("member"),
);

const rolesValidator = v.array(roleValidator);

const classStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

const enrollmentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("enrolled"),
  v.literal("waitlisted"),
  v.literal("dropped"),
);

const sessionStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("cancelled"),
  v.literal("completed"),
);

const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("late"),
  v.literal("excused"),
);

const attendanceReasonValidator = v.union(
  v.literal("sick"),
  v.literal("injured"),
  v.literal("homework"),
  v.literal("vacation"),
  v.literal("school-event"),
  v.literal("no-ride"),
);

const weekdayValidator = v.union(
  v.literal("sunday"),
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday"),
);

const sessionSourceValidator = v.union(
  v.literal("generated"),
  v.literal("manual"),
);

const studentStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived"),
);

const studentGenderValidator = v.union(
  v.literal(""),
  v.literal("Female"),
  v.literal("Male"),
);

type DbCtx = QueryCtx | MutationCtx;

function isAdmin(user: Doc<"users"> | null) {
  return hasUserRole(user, "admin");
}

function isStaff(user: Doc<"users"> | null) {
  return hasUserRole(user, "staff");
}

async function canManageStudent(
  ctx: DbCtx,
  user: Doc<"users">,
  student: Id<"students">,
) {
  if (isAdmin(user)) {
    return true;
  }

  const contacts = await ctx.db
    .query("studentContacts")
    .withIndex("byUser", (q) => q.eq("user", user._id))
    .collect();

  return contacts.some(
    (contact) => contact.student === student && contact.canManage,
  );
}

async function requireAdmin(ctx: QueryCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!isAdmin(user)) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function requireStaff(ctx: QueryCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!isStaff(user)) {
    throw new Error("Unauthorized");
  }
  return user;
}

function validateNamedDateRange(
  name: string,
  startDate: string,
  endDate: string,
) {
  if (!name.trim()) {
    throw new Error("Name is required.");
  }
  if (!startDate || !endDate) {
    throw new Error("Start and end dates are required.");
  }
  if (endDate < startDate) {
    throw new Error("End date must be on or after the start date.");
  }
}

function validateClassAgeRange(minAge?: number, maxAge?: number) {
  for (const [label, age] of [
    ["Minimum age", minAge],
    ["Maximum age", maxAge],
  ] as const) {
    if (age !== undefined && (!Number.isInteger(age) || age < 0)) {
      throw new Error(`${label} must be a whole number of zero or more.`);
    }
  }

  if (minAge !== undefined && maxAge !== undefined && maxAge < minAge) {
    throw new Error("Maximum age must be greater than or equal to minimum age.");
  }
}

async function setClassSeason(
  ctx: MutationCtx,
  classId: Id<"classes">,
  seasonId?: Id<"seasons">,
) {
  const existingLinks = await ctx.db
    .query("seasonClasses")
    .withIndex("byClass", (q) => q.eq("class", classId))
    .collect();

  if (seasonId) {
    const season = await ctx.db.get(seasonId);
    if (!season) {
      throw new Error("Season not found.");
    }
  }

  await Promise.all(
    existingLinks
      .filter((link) => link.season !== seasonId)
      .map((link) => ctx.db.delete(link._id)),
  );

  if (
    seasonId &&
    !existingLinks.some((link) => link.season === seasonId)
  ) {
    await ctx.db.insert("seasonClasses", {
      season: seasonId,
      class: classId,
    });
  }
}

async function getEnrollmentRows(ctx: QueryCtx, classId: Id<"classes">) {
  const enrollments = await ctx.db
    .query("classEnrollments")
    .withIndex("byClass", (q) => q.eq("classId", classId))
    .collect();

  return await Promise.all(
    enrollments.map(async (enrollment) => {
      const student = await ctx.db.get(enrollment.student);

      return {
        ...enrollment,
        student,
        photoUrl: student?.photo ? await ctx.storage.getUrl(student.photo) : null,
        requestedBy: enrollment.requestedBy
          ? await ctx.db.get(enrollment.requestedBy)
          : null,
      };
    }),
  );
}

async function getStaffAttendanceSessionRow(
  ctx: QueryCtx,
  session: Doc<"sessions">,
) {
  const classItem = await ctx.db.get(session.classId);
  const enrollments = await getEnrollmentRows(ctx, session.classId);
  const sessionStudents = await ctx.db
    .query("sessionStudents")
    .withIndex("bySession", (q) => q.eq("session", session._id))
    .collect();
  const addedStudentRows = await Promise.all(
    sessionStudents.map(async (sessionStudent) => {
      const student = await ctx.db.get(sessionStudent.student);

      return {
        ...sessionStudent,
        status: "session" as const,
        student,
        photoUrl: student?.photo ? await ctx.storage.getUrl(student.photo) : null,
        requestedBy: await ctx.db.get(sessionStudent.addedBy),
      };
    }),
  );
  const attendance = await ctx.db
    .query("attendanceRecords")
    .withIndex("bySession", (q) => q.eq("session", session._id))
    .collect();
  const datedEnrollments = enrollments.filter(
    (enrollment) =>
      (enrollment.status === "enrolled" || enrollment.status === "pending") &&
      isDateBetween(session.date, enrollment.startDate, enrollment.endDate),
  );
  const rosterStudentIds = new Set(
    datedEnrollments
      .map((enrollment) => enrollment.student?._id)
      .filter((student): student is Id<"students"> => Boolean(student)),
  );
  const extraStudents = addedStudentRows.filter((row) => {
    if (!row.student || rosterStudentIds.has(row.student._id)) {
      return false;
    }
    rosterStudentIds.add(row.student._id);
    return true;
  });
  const availableStudents = await Promise.all(
    (await ctx.db.query("students").collect())
      .filter(
        (student) =>
          student.status === "active" && !rosterStudentIds.has(student._id),
      )
      .map(async (student) => ({
        student,
        photoUrl: student.photo ? await ctx.storage.getUrl(student.photo) : null,
      })),
  );

  return {
    session,
    classItem,
    enrollments: [...datedEnrollments, ...extraStudents],
    availableStudents,
    attendance,
  };
}

function canAccessAttendanceSession(
  user: Doc<"users">,
  row: Awaited<ReturnType<typeof getStaffAttendanceSessionRow>>,
) {
  return (
    isAdmin(user) ||
    row.session.assignedStaff?.includes(user._id) ||
    row.session.substitute === user._id ||
    row.classItem?.assignedStaff?.includes(user._id)
  );
}

export const currentUserAccess = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return {
      user,
      isAdmin: isAdmin(user),
      isStaff: isStaff(user),
    };
  },
});

export const searchApplication = query({
  args: {
    search: v.string(),
    activeRole: roleValidator,
  },
  handler: async (ctx, { search, activeRole }) => {
    const user = await getCurrentUser(ctx);
    const normalizedSearch = search.trim().toLowerCase();
    if (
      !user ||
      normalizedSearch.length === 0 ||
      !hasUserRole(user, activeRole)
    ) {
      return {
        accounts: [],
        students: [],
        classes: [],
        seasons: [],
      };
    }

    const includesSearch = (...values: Array<string | undefined>) =>
      values.some((value) => value?.toLowerCase().includes(normalizedSearch));
    const accountEmail = (account: Doc<"users">) =>
      Array.isArray(account.email) ? account.email.join(", ") : account.email;

    const accounts = activeRole === "admin"
      ? (await ctx.db.query("users").collect())
          .filter((account) =>
            includesSearch(
              account.displayName,
              account.name,
              account.firstName,
              account.lastName,
              [account.firstName, account.lastName].filter(Boolean).join(" "),
              accountEmail(account),
              ...resolveUserRoles(account),
            ),
          )
          .sort((a, b) =>
            (
              a.displayName ||
              [a.firstName, a.lastName].filter(Boolean).join(" ") ||
              a.name ||
              accountEmail(a) ||
              ""
            ).localeCompare(
              b.displayName ||
                [b.firstName, b.lastName].filter(Boolean).join(" ") ||
                b.name ||
                accountEmail(b) ||
                "",
            ),
          )
          .slice(0, 10)
          .map((account) => ({
            id: account._id,
            title:
              account.displayName ||
              [account.firstName, account.lastName].filter(Boolean).join(" ") ||
              account.name ||
              accountEmail(account) ||
              "Unnamed account",
            subtitle: [
              accountEmail(account),
              resolveUserRoles(account).join(", "),
            ]
              .filter(Boolean)
              .join(" · "),
            href: `/admin/accounts/${account._id}`,
          }))
      : [];

    const studentDocs =
      activeRole === "admin"
        ? await ctx.db.query("students").collect()
        : activeRole === "member"
          ? await Promise.all(
              (
                await ctx.db
                  .query("studentContacts")
                  .withIndex("byUser", (q) => q.eq("user", user._id))
                  .collect()
              ).map((contact) => ctx.db.get(contact.student)),
            )
          : [];
    const seenStudents = new Set<Id<"students">>();
    const students = studentDocs
      .filter((student): student is Doc<"students"> => student !== null)
      .filter((student) => {
        if (seenStudents.has(student._id)) {
          return false;
        }
        seenStudents.add(student._id);
        return includesSearch(
          student.firstName,
          student.lastName,
          student.preferredName,
          `${student.firstName} ${student.lastName}`,
        );
      })
      .sort((a, b) =>
        (a.preferredName || `${a.firstName} ${a.lastName}`).localeCompare(
          b.preferredName || `${b.firstName} ${b.lastName}`,
        ),
      )
      .slice(0, 10)
      .map((student) => ({
        id: student._id,
        title:
          student.preferredName || `${student.firstName} ${student.lastName}`,
        subtitle: `${student.firstName} ${student.lastName} · ${student.status}`,
        href: activeRole === "admin"
          ? `/admin/students/${student._id}`
          : `/students/${student._id}`,
      }));

    const classDocs = await ctx.db.query("classes").collect();
    const classes = classDocs
      .filter((classItem) => {
        if (activeRole === "admin") {
          return true;
        }
        if (activeRole === "staff") {
          return (
            classItem.status === "published" &&
            classItem.assignedStaff?.includes(user._id)
          );
        }
        return classItem.status === "published";
      })
      .filter((classItem) =>
        includesSearch(
          classItem.title,
          classItem.description,
          classItem.scheduleSummary,
          classItem.location,
        ),
      )
      .sort(compareClassesBySchedule)
      .slice(0, 10)
      .map((classItem) => ({
        id: classItem._id,
        title: classItem.title,
        subtitle: [
          classItem.scheduleSummary,
          classItem.location,
          activeRole === "admin" ? classItem.status : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        href: activeRole === "admin"
          ? `/admin/classes/${classItem._id}`
          : `/classes/${classItem._id}`,
      }));

    const seasons =
      activeRole === "admin" || activeRole === "member"
        ? (await ctx.db.query("seasons").collect())
            .filter(
              (season) =>
                activeRole === "admin" ||
                season.endDate >= todayValue("America/New_York"),
            )
            .filter((season) =>
              includesSearch(season.name, season.startDate, season.endDate),
            )
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .slice(0, 10)
            .map((season) => ({
              id: season._id,
              title: season.name,
              subtitle: `${season.startDate} - ${season.endDate}`,
              href:
                activeRole === "admin"
                  ? `/admin/classes?season=${season._id}`
                  : `/classes?season=${season._id}`,
            }))
        : [];

    return {
      accounts,
      students,
      classes,
      seasons,
    };
  },
});

export const listPublishedClasses = query({
  args: {
    seasonId: v.optional(v.id("seasons")),
    studentId: v.optional(v.id("students")),
    filterByAge: v.boolean(),
  },
  handler: async (ctx, { seasonId, studentId, filterByAge }) => {
    let classes = await ctx.db
      .query("classes")
      .withIndex("byStatus", (q) => q.eq("status", "published"))
      .collect();

    if (seasonId) {
      const seasonClassIds = new Set(
        (
          await ctx.db
            .query("seasonClasses")
            .withIndex("bySeason", (q) => q.eq("season", seasonId))
            .collect()
        ).map((link) => link.class),
      );
      classes = classes.filter((classItem) =>
        seasonClassIds.has(classItem._id),
      );
    }

    if (filterByAge && studentId) {
      const user = await getCurrentUser(ctx);
      if (!user) {
        return [];
      }
      const contact = (
        await ctx.db
          .query("studentContacts")
          .withIndex("byUser", (q) => q.eq("user", user._id))
          .collect()
      ).find((candidate) => candidate.student === studentId);
      if (!contact) {
        throw new Error("Student is not connected to this account.");
      }

      const student = await ctx.db.get(studentId);
      const age = calculateAgeOnDate(
        student?.dateOfBirth,
        todayValue("America/New_York"),
      );
      classes = classes.filter((classItem) => classMatchesAge(classItem, age));
    }

    return classes.sort(compareClassesBySchedule);
  },
});

export const listCurrentAndFutureSeasons = query({
  args: {},
  handler: async (ctx) => {
    const today = todayValue("America/New_York");
    return (await ctx.db.query("seasons").collect())
      .filter((season) => season.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  },
});

export const listMyStudentsForClassSelection = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byUser", (q) => q.eq("user", user._id))
      .collect();

    return (
      await Promise.all(
        contacts.map(async (contact) => {
          const student = await ctx.db.get(contact.student);
          if (!student) {
            return null;
          }
          return {
            student,
            photoUrl: student.photo
              ? await ctx.storage.getUrl(student.photo)
              : null,
          };
        }),
      )
    ).filter((row) => row !== null);
  },
});

export const getClassForSignup = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    const classItem = await ctx.db.get(classId);
    if (!classItem || classItem.status !== "published") {
      return null;
    }
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("byClass", (q) => q.eq("classId", classId))
      .collect();
    const enrollments = await ctx.db
      .query("classEnrollments")
      .withIndex("byClass", (q) => q.eq("classId", classId))
      .collect();
    const activeEnrollmentCount = enrollments.filter((enrollment) =>
      ["pending", "enrolled", "waitlisted"].includes(enrollment.status),
    ).length;

    return {
      classItem,
      sessions: sessions.filter((session) => session.active),
      activeEnrollmentCount,
    };
  },
});

export const listMyStudents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byUser", (q) => q.eq("user", user._id))
      .collect();

    return await Promise.all(
      contacts.map(async (contact) => {
        const student = await ctx.db.get(contact.student);
        const enrollments = await ctx.db
          .query("classEnrollments")
          .withIndex("byStudent", (q) => q.eq("student", contact.student))
          .collect();
        const classes = await Promise.all(
          enrollments
            .filter((enrollment) => enrollment.status !== "dropped")
            .map(async (enrollment) => ({
              enrollment,
              classItem: await ctx.db.get(enrollment.classId),
            })),
        );

        return {
          contact,
          student,
          photoUrl: student?.photo
            ? await ctx.storage.getUrl(student.photo)
            : null,
          classes: classes
            .filter(({ classItem }) => classItem !== null)
            .sort(compareRowsByClassSchedule),
        };
      }),
    );
  },
});

export const getMyStudent = query({
  args: { student: v.id("students") },
  handler: async (ctx, { student }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await canManageStudent(ctx, user, student))) {
      return null;
    }

    const studentDoc = await ctx.db.get(student);
    if (!studentDoc) {
      return null;
    }

    const contact = await ctx.db
      .query("studentContacts")
      .withIndex("byUser", (q) => q.eq("user", user._id))
      .collect()
      .then((contacts) =>
        contacts.find((candidate) => candidate.student === student),
      );
    const enrollments = await ctx.db
      .query("classEnrollments")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();

    const enrollmentRows = await Promise.all(
      enrollments
        .filter((enrollment) => enrollment.status !== "dropped")
        .map(async (enrollment) => ({
          ...enrollment,
          classItem: await ctx.db.get(enrollment.classId),
        })),
    );

    return {
      student: studentDoc,
      contact: contact || null,
      photoUrl: studentDoc.photo
        ? await ctx.storage.getUrl(studentDoc.photo)
        : null,
      enrollments: enrollmentRows.sort(compareRowsByClassSchedule),
    };
  },
});

export const createStudentForCurrentUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: studentGenderValidator,
    school: v.string(),
    allergies: v.string(),
    recital: v.boolean(),
    relationship: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      firstName,
      lastName,
      preferredName,
      dateOfBirth,
      gender,
      school,
      allergies,
      recital,
      relationship,
    },
  ) => {
    const user = await getCurrentUserOrThrow(ctx);
    const student = await ctx.db.insert("students", {
      firstName,
      lastName,
      preferredName,
      dateOfBirth,
      gender,
      school,
      allergies,
      recital,
      status: "active",
    });

    await ctx.db.insert("studentContacts", {
      student,
      user: user._id,
      relationship,
      canManage: true,
      isPrimary: true,
    });

    return student;
  },
});

export const generateStudentPhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUserOrThrow(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateMyStudent = mutation({
  args: {
    student: v.id("students"),
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: studentGenderValidator,
    school: v.string(),
    allergies: v.string(),
    recital: v.boolean(),
    photo: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    status: studentStatusValidator,
  },
  handler: async (ctx, { student, ...updates }) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (!(await canManageStudent(ctx, user, student))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(student, updates);
  },
});

export const signUpStudentForClass = mutation({
  args: {
    classId: v.id("classes"),
    student: v.id("students"),
  },
  handler: async (ctx, { classId, student }) => {
    const user = await getCurrentUserOrThrow(ctx);
    const classItem = await ctx.db.get(classId);
    if (!classItem || classItem.status !== "published") {
      throw new Error("Class is not available for signup");
    }

    const contact = await ctx.db
      .query("studentContacts")
      .withIndex("byUser", (q) => q.eq("user", user._id))
      .collect()
      .then((contacts) =>
        contacts.find(
          (candidate) => candidate.student === student && candidate.canManage,
        ),
      );

    if (!contact && !isAdmin(user)) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("classEnrollments")
      .withIndex("byClassStudent", (q) =>
        q.eq("classId", classId).eq("student", student),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("classEnrollments", {
      classId,
      student,
      requestedBy: user._id,
      status: "pending",
      startDate: todayValue(classItem.timezone),
    });
  },
});

export const adminListHolidays = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("holidays").collect();
  },
});

export const adminCreateHoliday = mutation({
  args: {
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const holiday = await ctx.db.insert("holidays", args);
    await syncAllGeneratedSessions(ctx);
    return holiday;
  },
});

export const adminUpdateHoliday = mutation({
  args: {
    holiday: v.id("holidays"),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { holiday, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(holiday, patch);
    await syncAllGeneratedSessions(ctx);
  },
});

export const adminDeleteHoliday = mutation({
  args: { holiday: v.id("holidays") },
  handler: async (ctx, { holiday }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(holiday);
    await syncAllGeneratedSessions(ctx);
  },
});

export const adminListSeasons = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const seasons = await ctx.db.query("seasons").collect();

    return await Promise.all(
      seasons
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map(async (season) => ({
          season,
          classCount: (
            await ctx.db
              .query("seasonClasses")
              .withIndex("bySeason", (q) => q.eq("season", season._id))
              .collect()
          ).length,
        })),
    );
  },
});

export const adminCreateSeason = mutation({
  args: {
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validateNamedDateRange(args.name, args.startDate, args.endDate);

    return await ctx.db.insert("seasons", {
      ...args,
      name: args.name.trim(),
    });
  },
});

export const adminUpdateSeason = mutation({
  args: {
    season: v.id("seasons"),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { season, ...patch }) => {
    await requireAdmin(ctx);
    validateNamedDateRange(patch.name, patch.startDate, patch.endDate);

    const existing = await ctx.db.get(season);
    if (!existing) {
      throw new Error("Season not found.");
    }

    await ctx.db.patch(season, {
      ...patch,
      name: patch.name.trim(),
    });
  },
});

export const adminDeleteSeason = mutation({
  args: { season: v.id("seasons") },
  handler: async (ctx, { season }) => {
    await requireAdmin(ctx);
    const classLinks = await ctx.db
      .query("seasonClasses")
      .withIndex("bySeason", (q) => q.eq("season", season))
      .collect();

    await Promise.all(classLinks.map((link) => ctx.db.delete(link._id)));
    await ctx.db.delete(season);
  },
});

export const adminListAccounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const adminGetAccount = query({
  args: { user: v.id("users") },
  handler: async (ctx, { user }) => {
    await requireAdmin(ctx);
    const account = await ctx.db.get(user);
    if (!account) {
      return null;
    }
    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byUser", (q) => q.eq("user", user))
      .collect();

    return {
      account,
      students: await Promise.all(
        contacts.map(async (contact) => ({
          contact,
          student: await ctx.db.get(contact.student),
        })),
      ),
    };
  },
});

export const adminCreateAccount = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    roles: rolesValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    const email = args.email.trim().toLowerCase();
    if (!firstName || !lastName) {
      throw new Error("First and last name are required.");
    }
    if (!email) {
      throw new Error("Email is required.");
    }
    const roles = normalizeUserRoles(args.roles as UserRole[]);
    if (roles.length === 0) {
      throw new Error("Select at least one role.");
    }

    const existing = (await ctx.db.query("users").collect()).find((user) => {
      const emails = Array.isArray(user.email) ? user.email : [user.email];
      return emails.some(
        (candidate) => candidate?.trim().toLowerCase() === email,
      );
    });
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    return await ctx.db.insert("users", {
      firstName,
      lastName,
      email,
      phone: args.phone?.trim() || undefined,
      roles,
      role: highestUserRole(roles),
      onboardingSource: "imported",
    });
  },
});

export const adminSetUserRoles = mutation({
  args: {
    user: v.id("users"),
    roles: rolesValidator,
  },
  handler: async (ctx, { user, roles: requestedRoles }) => {
    await requireAdmin(ctx);
    const roles = normalizeUserRoles(requestedRoles as UserRole[]);
    if (roles.length === 0) {
      throw new Error("Select at least one role.");
    }
    await ctx.db.patch(user, {
      roles,
      role: highestUserRole(roles),
    });
  },
});

export const adminListStudents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const students = await ctx.db.query("students").collect();
    return await Promise.all(
      students.map(async (student) => {
        const contacts = await ctx.db
          .query("studentContacts")
          .withIndex("byStudent", (q) => q.eq("student", student._id))
          .collect();
        return { student, contacts };
      }),
    );
  },
});

export const adminListStudentGroups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("groups").collect();
  },
});

export const adminGetStudent = query({
  args: { student: v.id("students") },
  handler: async (ctx, { student }) => {
    await requireAdmin(ctx);
    const studentDoc = await ctx.db.get(student);
    if (!studentDoc) {
      return null;
    }
    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();
    const enrollments = await ctx.db
      .query("classEnrollments")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();

    const enrollmentRows = await Promise.all(
      enrollments.map(async (enrollment) => ({
        ...enrollment,
        classItem: await ctx.db.get(enrollment.classId),
        requestedBy: enrollment.requestedBy
          ? await ctx.db.get(enrollment.requestedBy)
          : null,
      })),
    );

    return {
      student: studentDoc,
      photoUrl: studentDoc.photo
        ? await ctx.storage.getUrl(studentDoc.photo)
        : null,
      contacts: await Promise.all(
        contacts.map(async (contact) => ({
          ...contact,
          user: contact.user ? await ctx.db.get(contact.user) : null,
        })),
      ),
      enrollments: enrollmentRows.sort(compareRowsByClassSchedule),
    };
  },
});

export const adminGetStudentAttendanceReport = query({
  args: { student: v.id("students") },
  handler: async (ctx, { student }) => {
    await requireAdmin(ctx);
    const studentDoc = await ctx.db.get(student);
    if (!studentDoc) {
      return null;
    }

    const attendance = await ctx.db
      .query("attendanceRecords")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();

    const attendanceRows = (
      await Promise.all(
        attendance.map(async (record) => {
          const session = await ctx.db.get(record.session);
          if (!session) {
            return null;
          }

          return {
            record,
            session,
            classItem: await ctx.db.get(session.classId),
          };
        }),
      )
    ).filter((row) => row !== null);

    attendanceRows.sort((a, b) =>
      b.session.date.localeCompare(a.session.date),
    );

    return {
      student: studentDoc,
      photoUrl: studentDoc.photo
        ? await ctx.storage.getUrl(studentDoc.photo)
        : null,
      summary: {
        present: attendanceRows.filter(
          (row) => row.record.status === "present",
        ).length,
        absent: attendanceRows.filter((row) => row.record.status === "absent")
          .length,
      },
      absences: attendanceRows.filter(
        (row) => row.record.status === "absent",
      ),
    };
  },
});

export const adminCreateStudent = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: studentGenderValidator,
    groupId: v.optional(v.id("groups")),
    school: v.string(),
    allergies: v.string(),
    recital: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.groupId && !(await ctx.db.get(args.groupId))) {
      throw new Error("The selected group no longer exists.");
    }
    return await ctx.db.insert("students", {
      ...args,
      status: "active",
    });
  },
});

export const adminUpdateStudent = mutation({
  args: {
    student: v.id("students"),
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: studentGenderValidator,
    groupId: v.union(v.id("groups"), v.null()),
    school: v.string(),
    allergies: v.string(),
    recital: v.boolean(),
    photo: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    status: studentStatusValidator,
  },
  handler: async (ctx, { student, groupId, ...updates }) => {
    await requireAdmin(ctx);
    if (groupId && !(await ctx.db.get(groupId))) {
      throw new Error("The selected group no longer exists.");
    }
    await ctx.db.patch(student, {
      ...updates,
      groupId: groupId ?? undefined,
    });
  },
});

export const adminEnrollStudentInClass = mutation({
  args: {
    student: v.id("students"),
    classId: v.id("classes"),
    status: enrollmentStatusValidator,
    notes: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    prorateTuition: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    {
      student,
      classId,
      status,
      notes,
      startDate,
      endDate,
      prorateTuition,
    },
  ) => {
    const user = await requireAdmin(ctx);
    const studentDoc = await ctx.db.get(student);
    const classItem = await ctx.db.get(classId);
    if (!studentDoc || !classItem) {
      throw new Error("Student or class not found");
    }
    if (status === "enrolled" && prorateTuition === undefined) {
      throw new Error("Choose whether this enrollment should be prorated.");
    }
    validateEnrollmentDates({ status, startDate, endDate });

    const existing = await ctx.db
      .query("classEnrollments")
      .withIndex("byClassStudent", (q) =>
        q.eq("classId", classId).eq("student", student),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status,
        notes,
        startDate,
        endDate,
        prorateTuition:
          status === "enrolled"
            ? prorateTuition
            : existing.prorateTuition,
      });
      return existing._id;
    }

    return await ctx.db.insert("classEnrollments", {
      classId,
      student,
      requestedBy: user._id,
      status,
      notes,
      startDate,
      endDate,
      prorateTuition,
    });
  },
});

export const adminListClasses = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const classes = await ctx.db.query("classes").collect();
    classes.sort(compareClassesBySchedule);
    return await Promise.all(
      classes.map(async (classItem) => {
        const enrollments = await ctx.db
          .query("classEnrollments")
          .withIndex("byClass", (q) => q.eq("classId", classItem._id))
          .collect();
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("byClass", (q) => q.eq("classId", classItem._id))
          .collect();
        const seasonLink = await ctx.db
          .query("seasonClasses")
          .withIndex("byClass", (q) => q.eq("class", classItem._id))
          .first();
        return {
          classItem,
          enrollments,
          sessions,
          seasonId: seasonLink?.season,
        };
      }),
    );
  },
});

export const adminGetClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    await requireAdmin(ctx);
    const classItem = await ctx.db.get(classId);
    if (!classItem) {
      return null;
    }
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("byClass", (q) => q.eq("classId", classId))
      .collect();
    const seasonLink = await ctx.db
      .query("seasonClasses")
      .withIndex("byClass", (q) => q.eq("class", classId))
      .first();

    return {
      classItem,
      seasonId: seasonLink?.season,
      sessions,
      enrollments: await getEnrollmentRows(ctx, classId),
    };
  },
});

export const adminCreateClass = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: classStatusValidator,
    capacity: v.optional(v.number()),
    location: v.optional(v.string()),
    scheduleSummary: v.optional(v.string()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    weekdays: v.optional(v.array(weekdayValidator)),
    timezone: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.id("users"))),
    seasonId: v.optional(v.id("seasons")),
  },
  handler: async (ctx, { seasonId, ...args }) => {
    await requireAdmin(ctx);
    validateClassAgeRange(args.minAge, args.maxAge);
    const classId = await ctx.db.insert("classes", {
      ...args,
      timezone: args.timezone || "America/New_York",
      scheduleVersion: 1,
    });
    await setClassSeason(ctx, classId, seasonId);
    const classItem = await ctx.db.get(classId);
    if (classItem) {
      await syncGeneratedSessionsForClass(ctx, classItem);
    }
    return classId;
  },
});

export const adminUpdateClass = mutation({
  args: {
    classId: v.id("classes"),
    title: v.string(),
    description: v.optional(v.string()),
    status: classStatusValidator,
    capacity: v.optional(v.number()),
    location: v.optional(v.string()),
    scheduleSummary: v.optional(v.string()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    weekdays: v.optional(v.array(weekdayValidator)),
    timezone: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.id("users"))),
    seasonId: v.optional(v.id("seasons")),
  },
  handler: async (ctx, { classId, seasonId, ...patch }) => {
    await requireAdmin(ctx);
    validateClassAgeRange(patch.minAge, patch.maxAge);
    const existing = await ctx.db.get(classId);
    if (!existing) {
      throw new Error("Class not found.");
    }
    const scheduleVersion = (existing?.scheduleVersion || 0) + 1;
    await ctx.db.patch(classId, {
      ...patch,
      timezone: patch.timezone || "America/New_York",
      scheduleVersion,
    });
    await setClassSeason(ctx, classId, seasonId);
    const classItem = await ctx.db.get(classId);
    if (classItem) {
      await syncGeneratedSessionsForClass(ctx, classItem);
    }
  },
});

export const adminGenerateSessionsForClass = mutation({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    await requireAdmin(ctx);
    const classItem = await ctx.db.get(classId);
    if (!classItem) {
      throw new Error("Class not found");
    }
    await syncGeneratedSessionsForClass(ctx, classItem);
  },
});

export const adminCreateSession = mutation({
  args: {
    classId: v.id("classes"),
    date: v.string(),
    active: v.optional(v.boolean()),
    source: v.optional(sessionSourceValidator),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.id("users"))),
    substitute: v.optional(v.id("users")),
    status: sessionStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("sessions", {
      ...args,
      active: args.active ?? true,
      source: args.source || "manual",
      hasManualOverride: true,
    });
  },
});

export const adminSetSessionActive = mutation({
  args: {
    session: v.id("sessions"),
    active: v.boolean(),
  },
  handler: async (ctx, { session, active }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(session, {
      active,
      hasManualOverride: true,
    });
  },
});

export const adminUpdateEnrollmentStatus = mutation({
  args: {
    enrollment: v.id("classEnrollments"),
    status: enrollmentStatusValidator,
    endDate: v.optional(v.union(v.string(), v.null())),
    prorateTuition: v.optional(v.boolean()),
  },
  handler: async (ctx, { enrollment, status, endDate, prorateTuition }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(enrollment);
    if (!existing) {
      throw new Error("Enrollment not found.");
    }
    if (
      status === "enrolled" &&
      existing.status !== "enrolled" &&
      prorateTuition === undefined
    ) {
      throw new Error("Choose whether this enrollment should be prorated.");
    }
    const dates = resolveEnrollmentStatusDates({
      existingStatus: existing.status,
      nextStatus: status,
      existingStartDate: existing.startDate,
      existingEndDate: existing.endDate,
      endDate,
      today: todayValue(),
    });
    await ctx.db.patch(enrollment, {
      status,
      ...dates,
      prorateTuition:
        status === "enrolled" && prorateTuition !== undefined
          ? prorateTuition
          : existing.prorateTuition,
    });
  },
});

export const staffListClasses = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStaff(ctx);
    const classes = await ctx.db.query("classes").collect();
    if (isAdmin(user)) {
      return classes.sort(compareClassesBySchedule);
    }
    return classes
      .filter((classItem) => classItem.assignedStaff?.includes(user._id))
      .sort(compareClassesBySchedule);
  },
});

export const staffListSessionsByDate = query({
  args: {
    date: v.string(),
    showAll: v.boolean(),
  },
  handler: async (ctx, { date, showAll }) => {
    const user = await requireStaff(ctx);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("byDate", (q) => q.eq("date", date))
      .collect();
    const activeSessions = sessions.filter((session) => session.active);

    const sessionRows = await Promise.all(
      activeSessions.map((session) =>
        getStaffAttendanceSessionRow(ctx, session),
      ),
    );

    const visibleRows =
      showAll || isAdmin(user)
        ? sessionRows
        : sessionRows.filter((row) => canAccessAttendanceSession(user, row));

    return visibleRows;
  },
});

export const staffGetAttendanceSession = query({
  args: {
    session: v.id("sessions"),
  },
  handler: async (ctx, { session }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    if (!sessionDoc || !sessionDoc.active) {
      return null;
    }
    const row = await getStaffAttendanceSessionRow(ctx, sessionDoc);
    if (!canAccessAttendanceSession(user, row)) {
      throw new Error("Unauthorized");
    }
    return row;
  },
});

export const markAttendance = mutation({
  args: {
    session: v.id("sessions"),
    student: v.id("students"),
    status: attendanceStatusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { session, student, status, notes }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    if (!sessionDoc) {
      throw new Error("Session not found");
    }
    if (
      !isAdmin(user) &&
      !sessionDoc.assignedStaff?.includes(user._id) &&
      sessionDoc.substitute !== user._id
    ) {
      const classItem = await ctx.db.get(sessionDoc.classId);
      if (!classItem?.assignedStaff?.includes(user._id)) {
        throw new Error("Unauthorized");
      }
    }

    const existing = await ctx.db
      .query("attendanceRecords")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();

    const patch = {
      status,
      notes,
      ...(status === "absent" ? {} : { reason: undefined }),
      markedBy: user._id,
      markedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("attendanceRecords", {
      session,
      student,
      ...patch,
    });
  },
});

export const updateAttendanceReason = mutation({
  args: {
    session: v.id("sessions"),
    student: v.id("students"),
    reason: v.optional(attendanceReasonValidator),
  },
  handler: async (ctx, { session, student, reason }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    if (!sessionDoc) {
      throw new Error("Session not found");
    }
    if (
      !isAdmin(user) &&
      !sessionDoc.assignedStaff?.includes(user._id) &&
      sessionDoc.substitute !== user._id
    ) {
      const classItem = await ctx.db.get(sessionDoc.classId);
      if (!classItem?.assignedStaff?.includes(user._id)) {
        throw new Error("Unauthorized");
      }
    }

    const attendance = await ctx.db
      .query("attendanceRecords")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();

    if (!attendance || attendance.status !== "absent") {
      throw new Error("An absence reason requires an absent attendance mark.");
    }

    await ctx.db.patch(attendance._id, {
      reason,
      markedBy: user._id,
      markedAt: Date.now(),
    });
  },
});

export const clearAttendance = mutation({
  args: {
    session: v.id("sessions"),
    student: v.id("students"),
  },
  handler: async (ctx, { session, student }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    if (!sessionDoc) {
      throw new Error("Session not found");
    }
    if (
      !isAdmin(user) &&
      !sessionDoc.assignedStaff?.includes(user._id) &&
      sessionDoc.substitute !== user._id
    ) {
      const classItem = await ctx.db.get(sessionDoc.classId);
      if (!classItem?.assignedStaff?.includes(user._id)) {
        throw new Error("Unauthorized");
      }
    }

    const existing = await ctx.db
      .query("attendanceRecords")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const addStudentToSession = mutation({
  args: {
    session: v.id("sessions"),
    student: v.id("students"),
  },
  handler: async (ctx, { session, student }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    const studentDoc = await ctx.db.get(student);
    if (!sessionDoc || !studentDoc) {
      throw new Error("Session or student not found");
    }
    if (
      !isAdmin(user) &&
      !sessionDoc.assignedStaff?.includes(user._id) &&
      sessionDoc.substitute !== user._id
    ) {
      const classItem = await ctx.db.get(sessionDoc.classId);
      if (!classItem?.assignedStaff?.includes(user._id)) {
        throw new Error("Unauthorized");
      }
    }

    const enrollment = await ctx.db
      .query("classEnrollments")
      .withIndex("byClassStudent", (q) =>
        q.eq("classId", sessionDoc.classId).eq("student", student),
      )
      .unique();
    if (
      enrollment &&
      (enrollment.status === "enrolled" || enrollment.status === "pending") &&
      isDateBetween(sessionDoc.date, enrollment.startDate, enrollment.endDate)
    ) {
      return null;
    }

    const existing = await ctx.db
      .query("sessionStudents")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("sessionStudents", {
      session,
      student,
      addedBy: user._id,
      addedAt: Date.now(),
    });
  },
});

export const removeStudentFromSession = mutation({
  args: {
    session: v.id("sessions"),
    student: v.id("students"),
  },
  handler: async (ctx, { session, student }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    if (!sessionDoc) {
      throw new Error("Session not found");
    }
    if (
      !isAdmin(user) &&
      !sessionDoc.assignedStaff?.includes(user._id) &&
      sessionDoc.substitute !== user._id
    ) {
      const classItem = await ctx.db.get(sessionDoc.classId);
      if (!classItem?.assignedStaff?.includes(user._id)) {
        throw new Error("Unauthorized");
      }
    }

    const sessionStudent = await ctx.db
      .query("sessionStudents")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();
    if (!sessionStudent) {
      throw new Error("Only students added to this session can be removed.");
    }

    const attendance = await ctx.db
      .query("attendanceRecords")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();
    if (attendance) {
      await ctx.db.delete(attendance._id);
    }

    await ctx.db.delete(sessionStudent._id);
  },
});

export const markSessionPresent = mutation({
  args: {
    session: v.id("sessions"),
  },
  handler: async (ctx, { session }) => {
    const user = await requireStaff(ctx);
    const sessionDoc = await ctx.db.get(session);
    if (!sessionDoc) {
      throw new Error("Session not found");
    }
    if (
      !isAdmin(user) &&
      !sessionDoc.assignedStaff?.includes(user._id) &&
      sessionDoc.substitute !== user._id
    ) {
      const classItem = await ctx.db.get(sessionDoc.classId);
      if (!classItem?.assignedStaff?.includes(user._id)) {
        throw new Error("Unauthorized");
      }
    }

    const enrollments = await ctx.db
      .query("classEnrollments")
      .withIndex("byClass", (q) => q.eq("classId", sessionDoc.classId))
      .collect();
    const roster = enrollments.filter(
      (enrollment) =>
        (enrollment.status === "enrolled" || enrollment.status === "pending") &&
        isDateBetween(sessionDoc.date, enrollment.startDate, enrollment.endDate),
    );
    const sessionStudents = await ctx.db
      .query("sessionStudents")
      .withIndex("bySession", (q) => q.eq("session", session))
      .collect();
    const rosterStudentIds = new Set(
      roster.map((enrollment) => enrollment.student),
    );
    for (const sessionStudent of sessionStudents) {
      rosterStudentIds.add(sessionStudent.student);
    }

    await Promise.all(
      Array.from(rosterStudentIds).map(async (student) => {
        const existing = await ctx.db
          .query("attendanceRecords")
          .withIndex("bySessionStudent", (q) =>
            q.eq("session", session).eq("student", student),
          )
          .unique();
        const patch = {
          status: "present" as const,
          reason: undefined,
          markedBy: user._id,
          markedAt: Date.now(),
        };

        if (existing) {
          await ctx.db.patch(existing._id, patch);
          return;
        }

        await ctx.db.insert("attendanceRecords", {
          session,
          student,
          ...patch,
        });
      }),
    );
  },
});
