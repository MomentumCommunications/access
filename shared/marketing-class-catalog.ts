export const CATALOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeCatalogSlug(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

export function isValidCatalogSlug(value: string) {
  return CATALOG_SLUG_PATTERN.test(value);
}

export function isMarketingClassVisible(classItem: {
  status: "draft" | "published" | "archived";
  visibleToGroupIds?: readonly unknown[];
}) {
  return (
    classItem.status === "published" &&
    (!classItem.visibleToGroupIds || classItem.visibleToGroupIds.length === 0)
  );
}

export function marketingClassHasVacancy({
  enrollmentOpen,
  capacity,
  activeEnrollmentCount,
}: {
  enrollmentOpen?: boolean;
  capacity?: number;
  activeEnrollmentCount: number;
}) {
  return (
    enrollmentOpen !== false &&
    (capacity === undefined || activeEnrollmentCount < capacity)
  );
}

export function classDurationMinutes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return null;

  const parseTime = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

export function publicInstructorName(user: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.displayName?.trim() || fullName.trim() || user.name?.trim() || "";
}

export function toPublicInstructors<
  T extends {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    staffSlug?: string;
  },
>(users: readonly (T | null)[]) {
  return users
    .filter((user): user is T => Boolean(user))
    .map((user) => ({
      name: publicInstructorName(user),
      staffSlug: user.staffSlug || null,
    }))
    .filter((instructor) => instructor.name);
}
