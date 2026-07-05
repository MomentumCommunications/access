import { query } from "./_generated/server";
import { hasUserRole } from "./lib/roles";
import { getCurrentUserOrThrow } from "./users";
import { buildEnrollmentReportsDashboard } from "../shared/admin-reports";

export const adminEnrollmentDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (!hasUserRole(user, "admin")) {
      throw new Error("Unauthorized");
    }

    const enrollments = await ctx.db.query("classEnrollments").collect();
    const classIds = [...new Set(enrollments.map((row) => row.classId))];
    const classes = await Promise.all(
      classIds.map(async (classId) => ctx.db.get(classId)),
    );
    const classesById = new Map(
      classes
        .filter((classItem) => classItem !== null)
        .map((classItem) => [classItem._id, classItem]),
    );

    return buildEnrollmentReportsDashboard(
      enrollments.map((enrollment) => {
        const classItem = classesById.get(enrollment.classId);
        return {
          enrollmentId: enrollment._id,
          classId: enrollment.classId,
          classTitle: classItem?.title ?? "Unknown class",
          classStatus: classItem?.status,
          studentId: enrollment.student,
          status: enrollment.status,
          startDate: enrollment.startDate,
          endDate: enrollment.endDate,
          classStartDate: classItem?.startDate,
          classEndDate: classItem?.endDate,
          createdAt: enrollment._creationTime,
        };
      }),
    );
  },
});
