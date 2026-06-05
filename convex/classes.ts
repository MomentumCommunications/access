import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { getCurrentUser, getCurrentUserOrThrow } from "./users";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("staff"),
  v.literal("member"),
);

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

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type DbCtx = QueryCtx | MutationCtx;
type ClassSchedule = Pick<
  Doc<"classes">,
  | "_id"
  | "location"
  | "assignedStaff"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime"
  | "weekdays"
  | "timezone"
  | "scheduleVersion"
>;

function isAdmin(user: Doc<"users"> | null) {
  return user?.role === "admin";
}

function isStaff(user: Doc<"users"> | null) {
  return user?.role === "staff" || user?.role === "admin";
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

function hasCompleteSchedule(classItem: ClassSchedule) {
  return (
    !!classItem.startDate &&
    !!classItem.endDate &&
    !!classItem.startTime &&
    !!classItem.endTime &&
    !!classItem.weekdays?.length
  );
}

function dateFromValue(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayValue(timezone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function isDateBetween(date: string, startDate?: string, endDate?: string) {
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function isDateInHoliday(date: string, holidays: Doc<"holidays">[]) {
  return holidays.some(
    (holiday) => date >= holiday.startDate && date <= holiday.endDate,
  );
}

function expandClassSchedule(
  classItem: ClassSchedule,
  holidays: Doc<"holidays">[],
) {
  if (!hasCompleteSchedule(classItem)) {
    return [];
  }

  const dates: string[] = [];
  const end = dateFromValue(classItem.endDate!);

  for (
    let cursor = dateFromValue(classItem.startDate!);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const date = formatDateValue(cursor);
    const weekday = WEEKDAYS[cursor.getDay()];
    if (
      classItem.weekdays?.includes(weekday) &&
      !isDateInHoliday(date, holidays)
    ) {
      dates.push(date);
    }
  }

  return dates;
}

async function sessionHasAttendance(ctx: DbCtx, session: Id<"sessions">) {
  const attendance = await ctx.db
    .query("attendanceRecords")
    .withIndex("bySession", (q) => q.eq("session", session))
    .first();
  return !!attendance;
}

async function syncGeneratedSessionsForClass(
  ctx: MutationCtx,
  classItem: ClassSchedule,
) {
  if (!hasCompleteSchedule(classItem)) {
    return;
  }

  const holidays = await ctx.db.query("holidays").collect();
  const desiredDates = new Set(expandClassSchedule(classItem, holidays));
  const today = todayValue(classItem.timezone);
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("byClass", (q) => q.eq("classId", classItem._id))
    .collect();
  const generatedSessions = sessions.filter(
    (session) => session.source === "generated",
  );

  for (const session of generatedSessions) {
    if (
      session.date < today ||
      session.hasManualOverride ||
      (await sessionHasAttendance(ctx, session._id))
    ) {
      continue;
    }

    if (!desiredDates.has(session.date)) {
      await ctx.db.patch(session._id, { active: false });
      continue;
    }

    await ctx.db.patch(session._id, {
      active: true,
      scheduleVersion: classItem.scheduleVersion,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      location: classItem.location,
      assignedStaff: classItem.assignedStaff,
    });
    desiredDates.delete(session.date);
  }

  for (const date of desiredDates) {
    const duplicate = sessions.find(
      (session) => session.source === "generated" && session.date === date,
    );
    if (duplicate) {
      continue;
    }

    await ctx.db.insert("sessions", {
      classId: classItem._id,
      date,
      active: true,
      source: "generated",
      scheduleVersion: classItem.scheduleVersion,
      hasManualOverride: false,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      location: classItem.location,
      assignedStaff: classItem.assignedStaff,
      status: "scheduled",
    });
  }
}

async function syncAllGeneratedSessions(ctx: MutationCtx) {
  const classes = await ctx.db.query("classes").collect();
  for (const classItem of classes) {
    await syncGeneratedSessionsForClass(ctx, classItem);
  }
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

export const listPublishedClasses = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("classes")
      .withIndex("byStatus", (q) => q.eq("status", "published"))
      .collect();
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
          classes: classes.filter(({ classItem }) => classItem !== null),
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

    return {
      student: studentDoc,
      contact: contact || null,
      photoUrl: studentDoc.photo
        ? await ctx.storage.getUrl(studentDoc.photo)
        : null,
      enrollments: await Promise.all(
        enrollments
          .filter((enrollment) => enrollment.status !== "dropped")
          .map(async (enrollment) => ({
            ...enrollment,
            classItem: await ctx.db.get(enrollment.classId),
          })),
      ),
    };
  },
});

export const createStudentForCurrentUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    relationship: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { firstName, lastName, preferredName, dateOfBirth, relationship },
  ) => {
    const user = await getCurrentUserOrThrow(ctx);
    const student = await ctx.db.insert("students", {
      firstName,
      lastName,
      preferredName,
      dateOfBirth,
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

export const adminSetUserRole = mutation({
  args: {
    user: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, { user, role }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(user, { role });
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
      enrollments: await Promise.all(
        enrollments.map(async (enrollment) => ({
          ...enrollment,
          classItem: await ctx.db.get(enrollment.classId),
          requestedBy: enrollment.requestedBy
            ? await ctx.db.get(enrollment.requestedBy)
            : null,
        })),
      ),
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
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    photo: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    status: studentStatusValidator,
  },
  handler: async (ctx, { student, ...updates }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(student, updates);
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
  },
  handler: async (
    ctx,
    { student, classId, status, notes, startDate, endDate },
  ) => {
    const user = await requireAdmin(ctx);
    const studentDoc = await ctx.db.get(student);
    const classItem = await ctx.db.get(classId);
    if (!studentDoc || !classItem) {
      throw new Error("Student or class not found");
    }

    const existing = await ctx.db
      .query("classEnrollments")
      .withIndex("byClassStudent", (q) =>
        q.eq("classId", classId).eq("student", student),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { status, notes, startDate, endDate });
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
    });
  },
});

export const adminListClasses = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const classes = await ctx.db.query("classes").collect();
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
        return { classItem, enrollments, sessions };
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

    return {
      classItem,
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
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    weekdays: v.optional(v.array(weekdayValidator)),
    timezone: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const classId = await ctx.db.insert("classes", {
      ...args,
      timezone: args.timezone || "America/New_York",
      scheduleVersion: 1,
    });
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
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    weekdays: v.optional(v.array(weekdayValidator)),
    timezone: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, { classId, ...patch }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(classId);
    const scheduleVersion = (existing?.scheduleVersion || 0) + 1;
    await ctx.db.patch(classId, {
      ...patch,
      timezone: patch.timezone || "America/New_York",
      scheduleVersion,
    });
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
  },
  handler: async (ctx, { enrollment, status }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(enrollment, { status });
  },
});

export const staffListClasses = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStaff(ctx);
    const classes = await ctx.db.query("classes").collect();
    if (isAdmin(user)) {
      return classes;
    }
    return classes.filter((classItem) =>
      classItem.assignedStaff?.includes(user._id),
    );
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
