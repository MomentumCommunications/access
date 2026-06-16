import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "./_generated/server";
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
import {
  requiresStudentStatusConfirmation,
  studentEnrollmentCleanup,
} from "../shared/student-status";
import {
  assertClassModeChangeAllowed,
  isActiveSessionSignup,
  occupiesSessionCapacity,
  planSessionSignupSync,
  resolvedClassEnrollmentMode,
  validateClassEnrollmentConfig,
  type SessionSignupStatus,
} from "../shared/per-session-signup";
import {
  buildPerSessionSignupEvent,
  getSessionSelectionChange,
} from "../shared/activity-log";
import {
  classVisibleToStudentGroup,
  studentSelfServiceEnrollmentAllowed,
} from "../shared/class-enrollment-policy";
import { resolvedClassEnrollmentOpen } from "../shared/class-enrollment-selection";
import { calculateEnrollmentEstimate } from "../shared/class-enrollment-estimate";
import { matchTuitionTier } from "../shared/tuition-pricing";
import { classWeeklyMinutes } from "./lib/billing/weeklyClassHours";
import { recordActivityEvent } from "./lib/activityLog";
import { ensureDefaultHouseholdBilling } from "./lib/householdBilling";
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

const classEnrollmentModeValidator = v.union(
  v.literal("standard"),
  v.literal("per_session"),
);

const sessionSignupStatusValidator = v.union(
  v.literal("pending"),
  v.literal("enrolled"),
  v.literal("waitlisted"),
  v.literal("cancelled"),
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

const classSessionSelectionValidator = v.object({
  classId: v.id("classes"),
  sessionIds: v.array(v.id("sessions")),
});

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

function studentDisplayName(student: Doc<"students">) {
  return (
    student.preferredName ||
    `${student.firstName} ${student.lastName}`.trim()
  );
}

async function getStudentPerSessionClasses(
  ctx: DbCtx,
  student: Id<"students">,
) {
  const studentDoc = await ctx.db.get(student);
  const studentGroup = studentDoc?.groupId
    ? await ctx.db.get(studentDoc.groupId)
    : null;
  const signups = (
    await ctx.db
      .query("classSessionSignups")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect()
  ).filter((signup) => isActiveSessionSignup(signup.status));
  const signupsByClass = new Map<
    Id<"classes">,
    Doc<"classSessionSignups">[]
  >();
  for (const signup of signups) {
    const rows = signupsByClass.get(signup.classId) || [];
    rows.push(signup);
    signupsByClass.set(signup.classId, rows);
  }

  const rows = await Promise.all(
    [...signupsByClass.entries()].map(async ([classId, classSignups]) => {
      const classItem = await ctx.db.get(classId);
      if (
        !classItem ||
        resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "per_session"
      ) {
        return null;
      }
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("byClass", (q) => q.eq("classId", classId))
        .collect();
      const sessionsById = new Map(
        sessions.map((session) => [session._id, session]),
      );
      const selectedSessions = classSignups
        .map((signup) => ({
          signup,
          session: sessionsById.get(signup.session) || null,
        }))
        .filter(
          (
            row,
          ): row is {
            signup: Doc<"classSessionSignups">;
            session: Doc<"sessions">;
          } => row.session !== null,
        )
        .sort(
          (left, right) =>
            left.session.date.localeCompare(right.session.date) ||
            (left.session.startTime || "").localeCompare(
              right.session.startTime || "",
            ),
        );
      const today = todayValue(classItem.timezone);
      const availableSessions =
        classItem.status === "published"
          ? sessions
              .filter(
                (session) =>
                  session.active &&
                  session.status !== "cancelled" &&
                  session.date >= today,
              )
              .sort(
                (left, right) =>
                  left.date.localeCompare(right.date) ||
                  (left.startTime || "").localeCompare(
                    right.startTime || "",
                  ),
              )
          : [];

      return {
        classItem,
        selectedSessions,
        availableSessions,
        canSelfManage: studentSelfServiceEnrollmentAllowed(studentGroup),
      };
    }),
  );

  return rows
    .filter((row) => row !== null)
    .sort((left, right) =>
      compareClassesBySchedule(left.classItem, right.classItem),
    );
}

async function getStudentEnrollmentGroup(
  ctx: DbCtx,
  studentDoc: Pick<Doc<"students">, "groupId">,
) {
  return studentDoc.groupId ? await ctx.db.get(studentDoc.groupId) : null;
}

async function assertStudentSelfServiceEnrollmentAllowed(
  ctx: DbCtx,
  studentDoc: Pick<Doc<"students">, "groupId">,
) {
  const group = await getStudentEnrollmentGroup(ctx, studentDoc);
  if (!studentSelfServiceEnrollmentAllowed(group)) {
    throw new Error(
      "This student's enrollment is managed by staff. Please contact us to make changes.",
    );
  }
}

function assertClassVisibleToStudent(
  classItem: Pick<Doc<"classes">, "title" | "visibleToGroupIds">,
  studentDoc: Pick<Doc<"students">, "groupId">,
) {
  if (
    !classVisibleToStudentGroup({
      studentGroupId: studentDoc.groupId,
      visibleToGroupIds: classItem.visibleToGroupIds,
    })
  ) {
    throw new Error(`${classItem.title} is not available for this student.`);
  }
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

async function validateClassVisibilityGroups(
  ctx: DbCtx,
  groupIds?: Id<"groups">[],
) {
  if (!groupIds || groupIds.length === 0) {
    return;
  }
  const uniqueIds = new Set(groupIds);
  if (uniqueIds.size !== groupIds.length) {
    throw new Error("Class visibility groups must be unique.");
  }
  const groups = await Promise.all(groupIds.map((groupId) => ctx.db.get(groupId)));
  if (groups.some((group) => !group)) {
    throw new Error("One or more class visibility groups no longer exist.");
  }
}

function normalizeClassVisibilityGroups(groupIds?: Id<"groups">[]) {
  return groupIds && groupIds.length > 0 ? groupIds : undefined;
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

async function getSessionSignupRows(
  ctx: QueryCtx,
  classId: Id<"classes">,
) {
  const signups = await ctx.db
    .query("classSessionSignups")
    .withIndex("byClass", (q) => q.eq("classId", classId))
    .collect();

  return await Promise.all(
    signups.map(async (signup) => {
      const [student, session] = await Promise.all([
        ctx.db.get(signup.student),
        ctx.db.get(signup.session),
      ]);
      return {
        ...signup,
        student,
        session,
        photoUrl: student?.photo
          ? await ctx.storage.getUrl(student.photo)
          : null,
        requestedBy: signup.requestedBy
          ? await ctx.db.get(signup.requestedBy)
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
  const sessionSignups = await ctx.db
    .query("classSessionSignups")
    .withIndex("bySession", (q) => q.eq("session", session._id))
    .collect();
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
  const classMode = resolvedClassEnrollmentMode(classItem?.enrollmentMode);
  const datedEnrollments =
    classMode === "per_session"
      ? (
          await Promise.all(
            sessionSignups
              .filter(
                (signup) =>
                  signup.status === "enrolled" ||
                  signup.status === "pending",
              )
              .map(async (signup) => {
                const student = await ctx.db.get(signup.student);
                return {
                  ...signup,
                  status: "session_signup" as const,
                  student,
                  photoUrl: student?.photo
                    ? await ctx.storage.getUrl(student.photo)
                    : null,
                  requestedBy: signup.requestedBy
                    ? await ctx.db.get(signup.requestedBy)
                    : null,
                };
              }),
          )
        ).filter((row) => row.student?.status === "active")
      : enrollments.filter(
          (enrollment) =>
            (enrollment.status === "enrolled" ||
              enrollment.status === "pending") &&
            enrollment.student?.status === "active" &&
            isDateBetween(
              session.date,
              enrollment.startDate,
              enrollment.endDate,
            ),
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
    const user = await getCurrentUser(ctx);
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

    let selectedStudent: Doc<"students"> | null = null;
    let selectedContact: Doc<"studentContacts"> | null = null;
    if (studentId) {
      if (!user) {
        return [];
      }
      selectedContact =
        await ctx.db
          .query("studentContacts")
          .withIndex("byUser", (q) => q.eq("user", user._id))
          .collect()
          .then(
            (contacts) =>
              contacts.find((candidate) => candidate.student === studentId) ||
              null,
          );
      if (!selectedContact) {
        throw new Error("Student is not connected to this account.");
      }

      selectedStudent = await ctx.db.get(studentId);
      const age = calculateAgeOnDate(
        selectedStudent?.dateOfBirth,
        todayValue("America/New_York"),
      );
      if (filterByAge) {
        classes = classes.filter((classItem) =>
          classMatchesAge(classItem, age),
        );
      }
    }

    const selectedStudentAge = calculateAgeOnDate(
      selectedStudent?.dateOfBirth,
      todayValue("America/New_York"),
    );
    const selectedStudentGroup = selectedStudent
      ? await getStudentEnrollmentGroup(ctx, selectedStudent)
      : null;
    const selfServiceAllowed =
      studentSelfServiceEnrollmentAllowed(selectedStudentGroup);
    if (selectedStudent) {
      classes = classes.filter((classItem) =>
        classVisibleToStudentGroup({
          studentGroupId: selectedStudent?.groupId,
          visibleToGroupIds: classItem.visibleToGroupIds,
        }),
      );
    } else {
      classes = classes.filter(
        (classItem) =>
          !classItem.visibleToGroupIds ||
          classItem.visibleToGroupIds.length === 0,
      );
    }
    const rows = await Promise.all(
      classes.sort(compareClassesBySchedule).map(async (classItem) => {
        const [enrollments, sessions, sessionSignups] = await Promise.all([
          ctx.db
            .query("classEnrollments")
            .withIndex("byClass", (q) => q.eq("classId", classItem._id))
            .collect(),
          ctx.db
            .query("sessions")
            .withIndex("byClass", (q) => q.eq("classId", classItem._id))
            .collect(),
          ctx.db
            .query("classSessionSignups")
            .withIndex("byClass", (q) => q.eq("classId", classItem._id))
            .collect(),
        ]);
        const today = todayValue(classItem.timezone);
        const studentEnrollment = studentId
          ? enrollments.find((enrollment) => enrollment.student === studentId)
          : undefined;
        const studentSignups = new Map(
          sessionSignups
            .filter(
              (signup) =>
                signup.student === studentId &&
                isActiveSessionSignup(signup.status),
            )
            .map((signup) => [signup.session, signup]),
        );
        const activeEnrollmentCount = enrollments.filter(
          (enrollment) =>
            enrollment.status === "pending" ||
            enrollment.status === "enrolled",
        ).length;

        return {
          classItem,
          enrollment: studentEnrollment || null,
          activeEnrollmentCount,
          ageEligible: classMatchesAge(classItem, selectedStudentAge),
          canManage:
            (selectedContact?.canManage ?? false) && selfServiceAllowed,
          selfServiceManaged: !selfServiceAllowed,
          sessions: sessions
            .filter(
              (session) =>
                session.active &&
                session.status !== "cancelled" &&
                session.date >= today,
            )
            .sort(
              (left, right) =>
                left.date.localeCompare(right.date) ||
                (left.startTime || "").localeCompare(
                  right.startTime || "",
                ),
            )
            .map((session) => ({
              session,
              signup: studentSignups.get(session._id) || null,
              activeSignupCount: sessionSignups.filter(
                (signup) =>
                  signup.session === session._id &&
                  occupiesSessionCapacity(signup.status),
              ).length,
            })),
        };
      }),
    );

    return rows;
  },
});

export const estimateMyClassSelections = query({
  args: {
    student: v.id("students"),
    recurringClassIds: v.array(v.id("classes")),
    sessionSelections: v.array(classSessionSelectionValidator),
  },
  handler: async (
    ctx,
    { student, recurringClassIds, sessionSelections },
  ) => {
    const user = await getCurrentUserOrThrow(ctx);
    const studentDoc = await ctx.db.get(student);
    if (
      !studentDoc ||
      studentDoc.status !== "active" ||
      !(await canManageStudent(ctx, user, student))
    ) {
      throw new Error("Student is unavailable for enrollment.");
    }
    await assertStudentSelfServiceEnrollmentAllowed(ctx, studentDoc);

    const today = todayValue("America/New_York");
    const studentAge = calculateAgeOnDate(studentDoc.dateOfBirth, today);
    const currentEnrollments = await ctx.db
      .query("classEnrollments")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();
    const currentRows = await Promise.all(
      currentEnrollments
        .filter((enrollment) => enrollment.status === "enrolled")
        .map(async (enrollment) => ({
          enrollment,
          classItem: await ctx.db.get(enrollment.classId),
        })),
    );
    const currentWeeklyMinutes = currentRows.reduce((total, row) => {
      const { classItem, enrollment } = row;
      if (
        !classItem ||
        classItem.status === "archived" ||
        resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "standard" ||
        (enrollment.endDate && enrollment.endDate < today) ||
        (classItem.endDate && classItem.endDate < today)
      ) {
        return total;
      }
      return total + classWeeklyMinutes(classItem);
    }, 0);

    const uniqueRecurringIds = [...new Set(recurringClassIds)];
    const recurringClasses = await Promise.all(
      uniqueRecurringIds.map((classId) => ctx.db.get(classId)),
    );
    let selectedRecurringWeeklyMinutes = 0;
    const recurringSelections = [];
    for (const classItem of recurringClasses) {
      if (
        !classItem ||
        classItem.status !== "published" ||
        resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "standard"
      ) {
        throw new Error("One or more selected classes are unavailable.");
      }
      if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
        throw new Error(
          `${classItem.title} is closed to self-service enrollment.`,
        );
      }
      assertClassVisibleToStudent(classItem, studentDoc);
      if (!classMatchesAge(classItem, studentAge)) {
        throw new Error(`${classItem.title} does not match the student's age.`);
      }
      const existing = currentEnrollments.find(
        (enrollment) => enrollment.classId === classItem._id,
      );
      if (
        existing?.status === "enrolled" ||
        existing?.status === "pending" ||
        existing?.status === "waitlisted"
      ) {
        continue;
      }
      const weeklyMinutes = classWeeklyMinutes(classItem);
      selectedRecurringWeeklyMinutes += weeklyMinutes;
      recurringSelections.push({
        classId: classItem._id,
        title: classItem.title,
        weeklyMinutes,
      });
    }

    const selectedSessionChargesCents: number[] = [];
    const perSessionSelections = [];
    for (const selection of sessionSelections) {
      const classItem = await ctx.db.get(selection.classId);
      if (
        !classItem ||
        classItem.status !== "published" ||
        resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "per_session"
      ) {
        throw new Error("One or more selected session classes are unavailable.");
      }
      if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
        throw new Error(
          `${classItem.title} is closed to self-service enrollment.`,
        );
      }
      assertClassVisibleToStudent(classItem, studentDoc);
      validateClassEnrollmentConfig(
        "per_session",
        classItem.perSessionPriceCents,
      );
      if (!classMatchesAge(classItem, studentAge)) {
        throw new Error(`${classItem.title} does not match the student's age.`);
      }
      const uniqueSessionIds = [...new Set(selection.sessionIds)];
      const existingSignups = await ctx.db
        .query("classSessionSignups")
        .withIndex("byClassStudent", (q) =>
          q.eq("classId", classItem._id).eq("student", student),
        )
        .collect();
      const activeExistingIds = new Set(
        existingSignups
          .filter((signup) => isActiveSessionSignup(signup.status))
          .map((signup) => signup.session),
      );
      const newSessionIds = uniqueSessionIds.filter(
        (sessionId) => !activeExistingIds.has(sessionId),
      );
      const sessions = await Promise.all(
        newSessionIds.map((sessionId) => ctx.db.get(sessionId)),
      );
      for (const session of sessions) {
        if (
          !session ||
          session.classId !== classItem._id ||
          !session.active ||
          session.status === "cancelled" ||
          session.date < todayValue(classItem.timezone)
        ) {
          throw new Error("One or more selected sessions are unavailable.");
        }
        selectedSessionChargesCents.push(classItem.perSessionPriceCents!);
      }
      if (newSessionIds.length > 0) {
        perSessionSelections.push({
          classId: classItem._id,
          title: classItem.title,
          sessionCount: newSessionIds.length,
          amountCents:
            newSessionIds.length * classItem.perSessionPriceCents!,
        });
      }
    }

    const activeSchema = await ctx.db
      .query("pricingSchemas")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .first();
    const tiers = activeSchema
      ? await ctx.db
          .query("tuitionPricingTiers")
          .withIndex("byPricingSchemaOrder", (q) =>
            q.eq("pricingSchemaId", activeSchema._id),
          )
          .collect()
      : [];
    const estimate = calculateEnrollmentEstimate({
      currentWeeklyMinutes,
      selectedRecurringWeeklyMinutes,
      selectedSessionChargesCents,
      tiers,
    });
    const currentTier = matchTuitionTier(tiers, currentWeeklyMinutes);
    const proposedTier = matchTuitionTier(
      tiers,
      currentWeeklyMinutes + selectedRecurringWeeklyMinutes,
    );

    return {
      ...estimate,
      pricingSchema: activeSchema
        ? {
            name: activeSchema.name,
            version: activeSchema.version,
          }
        : null,
      currentTierLabel: currentTier?.label,
      proposedTierLabel: proposedTier?.label,
      recurringSelections,
      perSessionSelections,
    };
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
            contact,
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
    const user = await getCurrentUser(ctx);
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
    const contacts = user
      ? await ctx.db
          .query("studentContacts")
          .withIndex("byUser", (q) => q.eq("user", user._id))
          .collect()
      : [];
    if (
      classItem.visibleToGroupIds &&
      classItem.visibleToGroupIds.length > 0
    ) {
      const connectedStudents = await Promise.all(
        contacts.map((contact) => ctx.db.get(contact.student)),
      );
      const hasVisibleStudent = connectedStudents.some(
        (student) =>
          student &&
          classVisibleToStudentGroup({
            studentGroupId: student.groupId,
            visibleToGroupIds: classItem.visibleToGroupIds,
          }),
      );
      if (!hasVisibleStudent) {
        return null;
      }
    }
    const connectedStudentIds = new Set(
      contacts.map((contact) => contact.student),
    );
    const allSessionSignups = await ctx.db
      .query("classSessionSignups")
      .withIndex("byClass", (q) => q.eq("classId", classId))
      .collect();
    const today = todayValue(classItem.timezone);

    return {
      classItem,
      sessions: sessions
        .filter(
          (session) =>
            session.active &&
            session.status !== "cancelled" &&
            session.date >= today,
        )
        .sort(
          (left, right) =>
            left.date.localeCompare(right.date) ||
            (left.startTime || "").localeCompare(right.startTime || ""),
        ),
      activeEnrollmentCount:
        resolvedClassEnrollmentMode(classItem.enrollmentMode) === "per_session"
          ? allSessionSignups.filter((signup) =>
              isActiveSessionSignup(signup.status),
            ).length
          : activeEnrollmentCount,
      sessionSignups: allSessionSignups.filter((signup) =>
        connectedStudentIds.has(signup.student),
      ),
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
          perSessionClasses: student
            ? (await getStudentPerSessionClasses(ctx, student._id)).map(
                (row) => ({
                  classItem: row.classItem,
                  selectedCount: row.selectedSessions.length,
                }),
              )
            : [],
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
      perSessionClasses: await getStudentPerSessionClasses(ctx, student),
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
    const [classItem, studentDoc] = await Promise.all([
      ctx.db.get(classId),
      ctx.db.get(student),
    ]);
    if (!classItem || classItem.status !== "published") {
      throw new Error("Class is not available for signup");
    }
    if (!studentDoc || studentDoc.status !== "active") {
      throw new Error("Student is unavailable for enrollment.");
    }
    if (resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "standard") {
      throw new Error("Choose individual sessions for this class.");
    }
    if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
      throw new Error("Enrollment is closed for this class.");
    }
    await assertStudentSelfServiceEnrollmentAllowed(ctx, studentDoc);
    assertClassVisibleToStudent(classItem, studentDoc);

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

async function validateSelectedSessions(
  ctx: MutationCtx,
  classItem: Doc<"classes">,
  sessionIds: Id<"sessions">[],
) {
  if (resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "per_session") {
    throw new Error("This class does not use per-session signup.");
  }
  validateClassEnrollmentConfig(
    "per_session",
    classItem.perSessionPriceCents,
  );
  const uniqueSessionIds = [...new Set(sessionIds)];
  if (uniqueSessionIds.length === 0) {
    throw new Error("Select at least one session.");
  }
  const today = todayValue(classItem.timezone);
  const sessions = await Promise.all(
    uniqueSessionIds.map((sessionId) => ctx.db.get(sessionId)),
  );
  for (const session of sessions) {
    if (
      !session ||
      session.classId !== classItem._id ||
      !session.active ||
      session.status === "cancelled" ||
      session.date < today
    ) {
      throw new Error("One or more selected sessions are unavailable.");
    }
  }
  return sessions as Doc<"sessions">[];
}

async function syncStudentSessionSignups(
  ctx: MutationCtx,
  {
    classItem,
    student,
    requestedBy,
    sessionIds,
    status,
    preserveEnrolledSelections = false,
  }: {
    classItem: Doc<"classes">;
    student: Id<"students">;
    requestedBy?: Id<"users">;
    sessionIds: Id<"sessions">[];
    status: SessionSignupStatus;
    preserveEnrolledSelections?: boolean;
  },
) {
  if (sessionIds.length > 0) {
    await validateSelectedSessions(ctx, classItem, sessionIds);
  } else {
    if (
      resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "per_session"
    ) {
      throw new Error("This class does not use per-session signup.");
    }
    validateClassEnrollmentConfig(
      "per_session",
      classItem.perSessionPriceCents,
    );
  }
  const selected = new Set(sessionIds);
  const existing = await ctx.db
    .query("classSessionSignups")
    .withIndex("byClassStudent", (q) =>
      q.eq("classId", classItem._id).eq("student", student),
    )
    .collect();
  const previousSessionIds = existing
    .filter((signup) => isActiveSessionSignup(signup.status))
    .map((signup) => signup.session);
  const now = Date.now();
  const today = todayValue(classItem.timezone);
  const existingBySession = new Map(
    existing.map((signup) => [signup.session, signup]),
  );

  if (
    classItem.capacity !== undefined &&
    occupiesSessionCapacity(status)
  ) {
    for (const session of selected) {
      const existingSignup = existingBySession.get(session);
      if (
        existingSignup &&
        occupiesSessionCapacity(existingSignup.status)
      ) {
        continue;
      }
      const activeSignupCount = (
        await ctx.db
          .query("classSessionSignups")
          .withIndex("bySession", (q) => q.eq("session", session))
          .collect()
      ).filter((signup) => occupiesSessionCapacity(signup.status)).length;
      if (activeSignupCount >= classItem.capacity) {
        const sessionDoc = await ctx.db.get(session);
        throw new Error(
          `${sessionDoc?.date || "A selected session"} is at capacity.`,
        );
      }
    }
  }

  const editableExisting = [];
  for (const signup of existing) {
    const signupSession = await ctx.db.get(signup.session);
    if (
      !signupSession ||
      signupSession.date < today ||
      !signupSession.active ||
      signupSession.status === "cancelled"
    ) {
      selected.delete(signup.session);
      continue;
    }
    editableExisting.push(signup);
  }

  const actions = planSessionSignupSync(
    editableExisting.map((signup) => ({
      signupId: signup._id,
      sessionId: signup.session,
      status: signup.status,
    })),
    [...selected],
    status,
    preserveEnrolledSelections,
  );
  const existingById = new Map(
    editableExisting.map((signup) => [signup._id, signup]),
  );
  for (const action of actions) {
    if (action.action === "preserve") continue;
    if (action.action === "cancel") {
      await ctx.db.patch(action.signupId as Id<"classSessionSignups">, {
        status: "cancelled",
        updatedAt: now,
      });
      continue;
    }
    if (action.action === "update") {
      const signup = existingById.get(
        action.signupId as Id<"classSessionSignups">,
      );
      await ctx.db.patch(action.signupId as Id<"classSessionSignups">, {
        status: action.status,
        requestedBy: requestedBy || signup?.requestedBy,
        updatedAt: now,
      });
      continue;
    }
    await ctx.db.insert("classSessionSignups", {
      classId: classItem._id,
      session: action.sessionId as Id<"sessions">,
      student,
      requestedBy,
      status: action.status,
      unitPriceCents: classItem.perSessionPriceCents!,
      createdAt: now,
      updatedAt: now,
    });
  }

  const resultingSignups = await ctx.db
    .query("classSessionSignups")
    .withIndex("byClassStudent", (q) =>
      q.eq("classId", classItem._id).eq("student", student),
    )
    .collect();
  const change = getSessionSelectionChange(
    previousSessionIds,
    resultingSignups
      .filter((signup) => isActiveSessionSignup(signup.status))
      .map((signup) => signup.session),
  );
  if (change) {
    const studentDoc = await ctx.db.get(student);
    if (studentDoc) {
      await recordActivityEvent(ctx, {
        ...buildPerSessionSignupEvent({
          studentId: student,
          studentName: studentDisplayName(studentDoc),
          classId: classItem._id,
          className: classItem.title,
          actorId: requestedBy,
          change,
        }),
      });
    }
  }
}

export const signUpStudentForSessions = mutation({
  args: {
    classId: v.id("classes"),
    student: v.id("students"),
    sessions: v.array(v.id("sessions")),
  },
  handler: async (ctx, { classId, student, sessions }) => {
    const user = await getCurrentUserOrThrow(ctx);
    const [classItem, studentDoc] = await Promise.all([
      ctx.db.get(classId),
      ctx.db.get(student),
    ]);
    if (!classItem || classItem.status !== "published" || !studentDoc) {
      throw new Error("Class or student is unavailable.");
    }
    if (studentDoc.status !== "active") {
      throw new Error("Student is unavailable for enrollment.");
    }
    if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
      throw new Error("Enrollment is closed for this class.");
    }
    await assertStudentSelfServiceEnrollmentAllowed(ctx, studentDoc);
    assertClassVisibleToStudent(classItem, studentDoc);
    if (!(await canManageStudent(ctx, user, student))) {
      throw new Error("Unauthorized");
    }
    if (sessions.length === 0) {
      const existing = await ctx.db
        .query("classSessionSignups")
        .withIndex("byClassStudent", (q) =>
          q.eq("classId", classId).eq("student", student),
        )
        .collect();
      if (!existing.some((signup) => isActiveSessionSignup(signup.status))) {
        throw new Error("Select at least one session.");
      }
    }

    await syncStudentSessionSignups(ctx, {
      classItem,
      student,
      requestedBy: user._id,
      sessionIds: sessions,
      status: "pending",
      preserveEnrolledSelections: true,
    });
  },
});

export const saveMyClassSelections = mutation({
  args: {
    student: v.id("students"),
    recurringClassIds: v.array(v.id("classes")),
    sessionSelections: v.array(classSessionSelectionValidator),
  },
  handler: async (
    ctx,
    { student, recurringClassIds, sessionSelections },
  ) => {
    const user = await getCurrentUserOrThrow(ctx);
    const studentDoc = await ctx.db.get(student);
    if (
      !studentDoc ||
      studentDoc.status !== "active" ||
      !(await canManageStudent(ctx, user, student))
    ) {
      throw new Error("Student is unavailable for enrollment.");
    }
    await assertStudentSelfServiceEnrollmentAllowed(ctx, studentDoc);

    const uniqueRecurringIds = [...new Set(recurringClassIds)];
    const sessionIdsByClass = new Map<Id<"classes">, Set<Id<"sessions">>>();
    for (const selection of sessionSelections) {
      const ids = sessionIdsByClass.get(selection.classId) || new Set();
      for (const sessionId of selection.sessionIds) {
        ids.add(sessionId);
      }
      sessionIdsByClass.set(selection.classId, ids);
    }
    if (uniqueRecurringIds.length === 0 && sessionIdsByClass.size === 0) {
      throw new Error("Select at least one class or session.");
    }

    const studentAge = calculateAgeOnDate(
      studentDoc.dateOfBirth,
      todayValue("America/New_York"),
    );
    const recurringPlans = [];
    for (const classId of uniqueRecurringIds) {
      const classItem = await ctx.db.get(classId);
      if (
        !classItem ||
        classItem.status !== "published" ||
        resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "standard"
      ) {
        throw new Error("One or more selected classes are unavailable.");
      }
      if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
        throw new Error(
          `${classItem.title} is closed to self-service enrollment.`,
        );
      }
      assertClassVisibleToStudent(classItem, studentDoc);
      if (!classMatchesAge(classItem, studentAge)) {
        throw new Error(`${classItem.title} does not match the student's age.`);
      }
      const existing = await ctx.db
        .query("classEnrollments")
        .withIndex("byClassStudent", (q) =>
          q.eq("classId", classId).eq("student", student),
        )
        .unique();
      if (
        existing?.status === "enrolled" ||
        existing?.status === "pending" ||
        existing?.status === "waitlisted"
      ) {
        continue;
      }
      if (classItem.capacity !== undefined) {
        const occupied = (
          await ctx.db
            .query("classEnrollments")
            .withIndex("byClass", (q) => q.eq("classId", classId))
            .collect()
        ).filter(
          (enrollment) =>
            enrollment.status === "pending" ||
            enrollment.status === "enrolled",
        ).length;
        if (occupied >= classItem.capacity) {
          throw new Error(`${classItem.title} is currently full.`);
        }
      }
      recurringPlans.push({ classItem, existing });
    }

    const sessionPlans = [];
    for (const [classId, requestedIds] of sessionIdsByClass) {
      const classItem = await ctx.db.get(classId);
      if (
        !classItem ||
        classItem.status !== "published" ||
        resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "per_session"
      ) {
        throw new Error("One or more selected session classes are unavailable.");
      }
      if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
        throw new Error(
          `${classItem.title} is closed to self-service enrollment.`,
        );
      }
      assertClassVisibleToStudent(classItem, studentDoc);
      if (!classMatchesAge(classItem, studentAge)) {
        throw new Error(`${classItem.title} does not match the student's age.`);
      }
      const existing = await ctx.db
        .query("classSessionSignups")
        .withIndex("byClassStudent", (q) =>
          q.eq("classId", classId).eq("student", student),
        )
        .collect();
      const classToday = todayValue(classItem.timezone);
      const activeExistingIds = (
        await Promise.all(
          existing
            .filter((signup) => isActiveSessionSignup(signup.status))
            .map(async (signup) => ({
              signup,
              session: await ctx.db.get(signup.session),
            })),
        )
      )
        .filter(
          ({ session }) =>
            session &&
            session.active &&
            session.status !== "cancelled" &&
            session.date >= classToday,
        )
        .map(({ signup }) => signup.session);
      const combinedIds = [...new Set([...activeExistingIds, ...requestedIds])];
      await validateSelectedSessions(ctx, classItem, combinedIds);

      if (classItem.capacity !== undefined) {
        const activeExistingSet = new Set(activeExistingIds);
        for (const sessionId of requestedIds) {
          if (activeExistingSet.has(sessionId)) continue;
          const occupied = (
            await ctx.db
              .query("classSessionSignups")
              .withIndex("bySession", (q) => q.eq("session", sessionId))
              .collect()
          ).filter((signup) => occupiesSessionCapacity(signup.status)).length;
          if (occupied >= classItem.capacity) {
            const session = await ctx.db.get(sessionId);
            throw new Error(
              `${session?.date || "A selected session"} is at capacity.`,
            );
          }
        }
      }
      sessionPlans.push({
        classItem,
        combinedIds,
        requestedCount: [...requestedIds].filter(
          (sessionId) => !activeExistingIds.includes(sessionId),
        ).length,
      });
    }

    const now = Date.now();
    for (const { classItem, existing } of recurringPlans) {
      const enrollment = {
        requestedBy: user._id,
        status: "pending" as const,
        startDate: todayValue(classItem.timezone),
        endDate: undefined,
      };
      if (existing) {
        await ctx.db.patch(existing._id, enrollment);
      } else {
        await ctx.db.insert("classEnrollments", {
          classId: classItem._id,
          student,
          ...enrollment,
        });
      }
    }
    for (const { classItem, combinedIds } of sessionPlans) {
      await syncStudentSessionSignups(ctx, {
        classItem,
        student,
        requestedBy: user._id,
        sessionIds: combinedIds,
        status: "pending",
        preserveEnrolledSelections: true,
      });
    }

    return {
      recurringRequestCount: recurringPlans.length,
      sessionRequestCount: sessionPlans.reduce(
        (total, plan) => total + plan.requestedCount,
        0,
      ),
      savedAt: now,
    };
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

export const adminCreateAccountRecord = internalMutation({
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

    const userId = await ctx.db.insert("users", {
      firstName,
      lastName,
      email,
      phone: args.phone?.trim() || undefined,
      roles,
      role: highestUserRole(roles),
      onboardingSource: "imported",
    });
    await ensureDefaultHouseholdBilling(ctx, {
      userId,
      firstName,
      lastName,
    });
    return userId;
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
    const activityLog = await ctx.db
      .query("activityLog")
      .withIndex("byEntity", (q) =>
        q.eq("entityType", "student").eq("entityId", student),
      )
      .order("desc")
      .take(20);

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
      activityLog: await Promise.all(
        activityLog.map(async (event) => ({
          ...event,
          actor: event.actorId ? await ctx.db.get(event.actorId) : null,
        })),
      ),
    };
  },
});

export const adminConnectStudentAccount = mutation({
  args: {
    student: v.id("students"),
    user: v.id("users"),
    relationship: v.optional(v.string()),
    canManage: v.boolean(),
    isPrimary: v.boolean(),
  },
  handler: async (
    ctx,
    { student, user, relationship, canManage, isPrimary },
  ) => {
    await requireAdmin(ctx);
    const [studentDoc, account] = await Promise.all([
      ctx.db.get(student),
      ctx.db.get(user),
    ]);
    if (!studentDoc) {
      throw new Error("Student not found.");
    }
    if (!account) {
      throw new Error("Account not found.");
    }

    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();
    if (contacts.some((contact) => contact.user === user)) {
      throw new Error("This account is already connected to the student.");
    }

    const accountEmails = (
      Array.isArray(account.email) ? account.email : [account.email]
    )
      .filter((email): email is string => Boolean(email))
      .map((email) => email.trim().toLowerCase());
    const matchingInvite = contacts.find(
      (contact) =>
        !contact.user &&
        contact.inviteEmail &&
        accountEmails.includes(contact.inviteEmail.trim().toLowerCase()),
    );
    const nextIsPrimary = isPrimary || matchingInvite?.isPrimary === true;
    if (nextIsPrimary) {
      await Promise.all(
        contacts
          .filter(
            (contact) =>
              contact.isPrimary && contact._id !== matchingInvite?._id,
          )
          .map((contact) => ctx.db.patch(contact._id, { isPrimary: false })),
      );
    }
    const normalizedRelationship = relationship?.trim() || undefined;

    if (matchingInvite) {
      await ctx.db.patch(matchingInvite._id, {
        user,
        inviteEmail: undefined,
        relationship: normalizedRelationship || matchingInvite.relationship,
        canManage,
        isPrimary: nextIsPrimary,
      });
      return matchingInvite._id;
    }

    return await ctx.db.insert("studentContacts", {
      student,
      user,
      relationship: normalizedRelationship,
      canManage,
      isPrimary,
    });
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
    accountUser: v.optional(v.id("users")),
    relationship: v.optional(v.string()),
  },
  handler: async (ctx, { accountUser, relationship, ...studentValues }) => {
    await requireAdmin(ctx);
    if (
      studentValues.groupId &&
      !(await ctx.db.get(studentValues.groupId))
    ) {
      throw new Error("The selected group no longer exists.");
    }
    if (accountUser && !(await ctx.db.get(accountUser))) {
      throw new Error("The selected account no longer exists.");
    }

    const student = await ctx.db.insert("students", {
      ...studentValues,
      status: "active",
    });
    if (accountUser) {
      await ctx.db.insert("studentContacts", {
        student,
        user: accountUser,
        relationship: relationship?.trim() || undefined,
        canManage: true,
        isPrimary: true,
      });
    }
    return student;
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
    const existing = await ctx.db.get(student);
    if (!existing) {
      throw new Error("Student not found.");
    }
    if (groupId && !(await ctx.db.get(groupId))) {
      throw new Error("The selected group no longer exists.");
    }
    if (
      requiresStudentStatusConfirmation(existing.status, updates.status)
    ) {
      const today = todayValue();
      const enrollments = await ctx.db
        .query("classEnrollments")
        .withIndex("byStudent", (q) => q.eq("student", student))
        .collect();
      for (const enrollment of enrollments) {
        const cleanup = studentEnrollmentCleanup(enrollment, today);
        if (cleanup.action === "delete") {
          await ctx.db.delete(enrollment._id);
        } else if (cleanup.action === "drop") {
          await ctx.db.patch(enrollment._id, {
            status: "dropped",
            startDate: cleanup.startDate,
            endDate: cleanup.endDate,
          });
        }
      }
      const sessionSignups = await ctx.db
        .query("classSessionSignups")
        .withIndex("byStudent", (q) => q.eq("student", student))
        .collect();
      await Promise.all(
        sessionSignups
          .filter((signup) => signup.status !== "cancelled")
          .map((signup) =>
            ctx.db.patch(signup._id, {
              status: "cancelled",
              updatedAt: Date.now(),
            }),
          ),
      );
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
    if (resolvedClassEnrollmentMode(classItem.enrollmentMode) !== "standard") {
      throw new Error("Choose individual sessions for this class.");
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

export const adminSetStudentSessionSignups = mutation({
  args: {
    classId: v.id("classes"),
    student: v.id("students"),
    sessions: v.array(v.id("sessions")),
    status: sessionSignupStatusValidator,
  },
  handler: async (ctx, { classId, student, sessions, status }) => {
    const user = await requireAdmin(ctx);
    const [classItem, studentDoc] = await Promise.all([
      ctx.db.get(classId),
      ctx.db.get(student),
    ]);
    if (!classItem || !studentDoc) {
      throw new Error("Class or student not found.");
    }
    if (status === "cancelled") {
      throw new Error("Remove selected dates to cancel session signups.");
    }
    await syncStudentSessionSignups(ctx, {
      classItem,
      student,
      requestedBy: user._id,
      sessionIds: sessions,
      status,
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
        const sessionSignups = await ctx.db
          .query("classSessionSignups")
          .withIndex("byClass", (q) => q.eq("classId", classItem._id))
          .collect();
        const seasonLink = await ctx.db
          .query("seasonClasses")
          .withIndex("byClass", (q) => q.eq("class", classItem._id))
          .first();
        return {
          classItem,
          enrollments,
          sessionSignups,
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
      sessionSignups: await getSessionSignupRows(ctx, classId),
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
    enrollmentMode: classEnrollmentModeValidator,
    perSessionPriceCents: v.optional(v.number()),
    visibleToGroupIds: v.optional(v.array(v.id("groups"))),
  },
  handler: async (ctx, { seasonId, ...args }) => {
    await requireAdmin(ctx);
    validateClassAgeRange(args.minAge, args.maxAge);
    validateClassEnrollmentConfig(
      args.enrollmentMode,
      args.perSessionPriceCents,
    );
    await validateClassVisibilityGroups(ctx, args.visibleToGroupIds);
    const classId = await ctx.db.insert("classes", {
      ...args,
      visibleToGroupIds: normalizeClassVisibilityGroups(
        args.visibleToGroupIds,
      ),
      enrollmentOpen: true,
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
    enrollmentMode: classEnrollmentModeValidator,
    perSessionPriceCents: v.optional(v.number()),
    visibleToGroupIds: v.optional(v.array(v.id("groups"))),
  },
  handler: async (ctx, { classId, seasonId, ...patch }) => {
    await requireAdmin(ctx);
    validateClassAgeRange(patch.minAge, patch.maxAge);
    validateClassEnrollmentConfig(
      patch.enrollmentMode,
      patch.perSessionPriceCents,
    );
    await validateClassVisibilityGroups(ctx, patch.visibleToGroupIds);
    const existing = await ctx.db.get(classId);
    if (!existing) {
      throw new Error("Class not found.");
    }
    const [classEnrollments, sessionSignups] = await Promise.all([
      ctx.db
        .query("classEnrollments")
        .withIndex("byClass", (q) => q.eq("classId", classId))
        .collect(),
      ctx.db
        .query("classSessionSignups")
        .withIndex("byClass", (q) => q.eq("classId", classId))
        .collect(),
    ]);
    assertClassModeChangeAllowed({
      currentMode: resolvedClassEnrollmentMode(existing.enrollmentMode),
      nextMode: patch.enrollmentMode,
      hasActiveClassEnrollments: classEnrollments.some(
        (enrollment) => enrollment.status !== "dropped",
      ),
      hasActiveSessionSignups: sessionSignups.some((signup) =>
        isActiveSessionSignup(signup.status),
      ),
    });
    const scheduleVersion = (existing?.scheduleVersion || 0) + 1;
    await ctx.db.patch(classId, {
      ...patch,
      visibleToGroupIds: normalizeClassVisibilityGroups(
        patch.visibleToGroupIds,
      ),
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

export const adminSetClassEnrollmentOpen = mutation({
  args: {
    classId: v.id("classes"),
    enrollmentOpen: v.boolean(),
  },
  handler: async (ctx, { classId, enrollmentOpen }) => {
    await requireAdmin(ctx);
    const classItem = await ctx.db.get(classId);
    if (!classItem) {
      throw new Error("Class not found.");
    }
    await ctx.db.patch(classId, { enrollmentOpen });
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
    const classItem = await ctx.db.get(sessionDoc.classId);
    const signup = await ctx.db
      .query("classSessionSignups")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", session).eq("student", student),
      )
      .unique();
    const alreadyExpected =
      resolvedClassEnrollmentMode(classItem?.enrollmentMode) === "per_session"
        ? signup?.status === "enrolled" || signup?.status === "pending"
        : !!enrollment &&
          (enrollment.status === "enrolled" ||
            enrollment.status === "pending") &&
          isDateBetween(
            sessionDoc.date,
            enrollment.startDate,
            enrollment.endDate,
          );
    if (alreadyExpected) {
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

    const classItem = await ctx.db.get(sessionDoc.classId);
    const classMode = resolvedClassEnrollmentMode(classItem?.enrollmentMode);
    const rosterStudentIds = new Set<Id<"students">>();
    if (classMode === "per_session") {
      const signups = await ctx.db
        .query("classSessionSignups")
        .withIndex("bySession", (q) => q.eq("session", session))
        .collect();
      for (const signup of signups) {
        if (signup.status === "enrolled" || signup.status === "pending") {
          rosterStudentIds.add(signup.student);
        }
      }
    } else {
      const enrollments = await ctx.db
        .query("classEnrollments")
        .withIndex("byClass", (q) => q.eq("classId", sessionDoc.classId))
        .collect();
      for (const enrollment of enrollments) {
        if (
          (enrollment.status === "enrolled" ||
            enrollment.status === "pending") &&
          isDateBetween(
            sessionDoc.date,
            enrollment.startDate,
            enrollment.endDate,
          )
        ) {
          rosterStudentIds.add(enrollment.student);
        }
      }
    }
    const sessionStudents = await ctx.db
      .query("sessionStudents")
      .withIndex("bySession", (q) => q.eq("session", session))
      .collect();
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
