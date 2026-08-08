export type ClassRosterFilters = {
  seasonId?: string;
  group?: string;
  titleQuery?: string;
};

export function classMatchesRosterFilters(
  classItem: {
    title: string;
    visibleToGroupIds?: string[];
  },
  seasonId: string | undefined,
  filters: ClassRosterFilters,
) {
  if (filters.seasonId && seasonId !== filters.seasonId) return false;

  const visibleGroupIds = classItem.visibleToGroupIds || [];
  if (filters.group === "none" && visibleGroupIds.length > 0) return false;
  if (
    filters.group &&
    filters.group !== "none" &&
    !visibleGroupIds.includes(filters.group)
  ) {
    return false;
  }

  const titleQuery = filters.titleQuery?.trim().toLocaleLowerCase();
  return (
    !titleQuery || classItem.title.toLocaleLowerCase().includes(titleQuery)
  );
}

export function isPrintRosterEnrollment(status: string) {
  return status === "enrolled";
}

export function isCurrentRosterSession(
  session: {
    date: string;
    active: boolean;
    status: string;
  },
  today: string,
) {
  return (
    session.active && session.status !== "cancelled" && session.date >= today
  );
}

export function isPrintRosterSessionSignup(
  signup: { status: string; trialRequestId?: string },
  session: { date: string; active: boolean; status: string } | null,
  today: string,
) {
  if (
    signup.trialRequestId !== undefined ||
    (signup.status !== "pending" && signup.status !== "enrolled")
  ) {
    return false;
  }
  return session === null || isCurrentRosterSession(session, today);
}

export function isPrintRosterTrial(
  request: { status: string },
  session: { date: string; active: boolean; status: string } | null,
  today: string,
) {
  if (request.status !== "pending" && request.status !== "approved") {
    return false;
  }
  return session === null || isCurrentRosterSession(session, today);
}
