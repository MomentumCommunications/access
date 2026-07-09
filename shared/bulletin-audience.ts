export type BulletinAudience = {
  audience?: "all";
  groups?: readonly string[];
  group?: readonly string[];
  hidden?: boolean;
};

export type BulletinEvent = {
  date?: string | null;
  endDate?: string | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isBulletinVisibleToAudience(
  bulletin: BulletinAudience,
  groupIds: readonly string[],
  groupNames: readonly string[],
) {
  if (bulletin.hidden) return false;
  if (bulletin.audience === "all") return true;

  if (bulletin.groups?.length) {
    return bulletin.groups.some((groupId) => groupIds.includes(groupId));
  }

  if (bulletin.group?.length) {
    return bulletin.group.some(
      (group) => groupIds.includes(group) || groupNames.includes(group),
    );
  }

  return false;
}

function parseEventDate(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(
    DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00` : value,
  ).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isUpcomingBulletin(
  bulletin: BulletinEvent,
  now = new Date(),
) {
  if (!bulletin.date) return false;

  if (DATE_ONLY_PATTERN.test(bulletin.date)) {
    const endDate =
      bulletin.endDate && DATE_ONLY_PATTERN.test(bulletin.endDate)
        ? bulletin.endDate
        : bulletin.date;
    return endDate >= localDateKey(now);
  }

  const end = parseEventDate(bulletin.endDate);
  const start = parseEventDate(bulletin.date);
  return (end ?? start ?? 0) >= now.getTime();
}

export function findNextUpcomingBulletin<T extends BulletinEvent>(
  bulletins: readonly T[],
  now = new Date(),
) {
  return bulletins
    .filter((bulletin) => isUpcomingBulletin(bulletin, now))
    .sort(
      (a, b) =>
        (parseEventDate(a.date) ?? Number.MAX_SAFE_INTEGER) -
        (parseEventDate(b.date) ?? Number.MAX_SAFE_INTEGER),
    )[0];
}
