import { format, isValid, isSameDay, isSameYear } from "date-fns";

export type BulletinDate = {
  date?: string | null;
  endDate?: string | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseBulletinDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(
    DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00` : value,
  );

  return isValid(date) ? date : null;
}

export function getBulletinSortDate(bulletin: BulletinDate) {
  return parseBulletinDate(bulletin.endDate) || parseBulletinDate(bulletin.date);
}

export function formatBulletinDate(bulletin: BulletinDate) {
  const start = parseBulletinDate(bulletin.date);
  const end = parseBulletinDate(bulletin.endDate);

  if (!start) return "";

  if (end && !isSameDay(start, end)) {
    if (isSameYear(start, end)) {
      return `${format(start, "iii, MMMM d")} - ${format(
        end,
        "iii, MMMM d, yyyy",
      )}`;
    }

    return `${format(start, "iii, MMMM d, yyyy")} - ${format(
      end,
      "iii, MMMM d, yyyy",
    )}`;
  }

  if (bulletin.date?.includes("T")) {
    return format(start, "iii, MMMM d, yyyy 'at' h:mm a");
  }

  return format(start, "iii, MMMM d, yyyy");
}
