import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { compareClassesBySchedule } from "./lib/classSorting";
import {
  classDurationMinutes,
  isMarketingClassVisible,
  marketingClassHasVacancy,
  toPublicInstructors,
} from "../shared/marketing-class-catalog";

export const listClasses = internalQuery({
  args: { seasonSlug: v.string() },
  handler: async (ctx, { seasonSlug }) => {
    const season = await ctx.db
      .query("seasons")
      .withIndex("bySlug", (q) => q.eq("slug", seasonSlug))
      .first();
    if (!season) return null;

    const links = await ctx.db
      .query("seasonClasses")
      .withIndex("bySeason", (q) => q.eq("season", season._id))
      .collect();
    const linkedClasses = await Promise.all(
      links.map((link) => ctx.db.get(link.class)),
    );
    const classes = linkedClasses
      .filter((classItem): classItem is Doc<"classes"> => Boolean(classItem))
      .filter(isMarketingClassVisible)
      .sort(compareClassesBySchedule);

    const rows = await Promise.all(
      classes.map(async (classItem) => {
        const [enrollments, instructors] = await Promise.all([
          ctx.db
            .query("classEnrollments")
            .withIndex("byClass", (q) => q.eq("classId", classItem._id))
            .collect(),
          Promise.all(
            (classItem.assignedStaff || []).map((userId) => ctx.db.get(userId)),
          ),
        ]);
        const activeEnrollmentCount = enrollments.filter(
          (enrollment) =>
            enrollment.status === "pending" || enrollment.status === "enrolled",
        ).length;

        return {
          name: classItem.title,
          category: classItem.marketingCategory || "",
          days: classItem.weekdays || [],
          time: classItem.scheduleSummary || "",
          startTime: classItem.startTime || null,
          endTime: classItem.endTime || null,
          minAge: classItem.minAge ?? null,
          maxAge: classItem.maxAge ?? null,
          instructors: toPublicInstructors(instructors),
          studio: classItem.location || "",
          classSize: classItem.capacity ?? null,
          description: classItem.description || "",
          vacancy: marketingClassHasVacancy({
            enrollmentOpen: classItem.enrollmentOpen,
            capacity: classItem.capacity,
            activeEnrollmentCount,
          }),
          duration: classDurationMinutes(
            classItem.startTime,
            classItem.endTime,
          ),
          recital: classItem.recital ?? false,
          team: classItem.team ?? false,
          underattended: classItem.underattended ?? false,
        };
      }),
    );

    return {
      season: {
        key: season.slug!,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
      },
      classes: rows,
    };
  },
});
