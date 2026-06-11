import { format } from "date-fns";

export function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  const hasBirthdayPassed =
    monthDelta > 0 ||
    (monthDelta === 0 && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

export function formatAge(dateOfBirth?: string) {
  const age = calculateAge(dateOfBirth);
  return age === null ? "Not set" : `${age}`;
}

export function formatMDYYYY(date?: string) {
  if (!date) return "Not set";
  return format(new Date(date), "M/d/yyyy");
}

export function formatFullDate(date?: string) {
  if (!date) return "Not set";
  return format(new Date(date), "MMMM d, yyyy");
}

export function formatDateTime(timestamp?: number) {
  if (timestamp === undefined) return "Not set";
  return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
}

export function toDateTimeLocalValue(timestamp: number) {
  return format(new Date(timestamp), "yyyy-MM-dd'T'HH:mm");
}

function parseMilitaryTime(time?: string) {
  const match = time?.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  if (hour > 23) return null;

  return {
    time: `${hour % 12 || 12}:${match[2]}`,
    period: hour < 12 ? "AM" : "PM",
  };
}

export function formatTimeRange(startTime?: string, endTime?: string) {
  const start = parseMilitaryTime(startTime);
  const end = parseMilitaryTime(endTime);

  if (!start && !end) return "";
  if (!start) return `${end!.time} ${end!.period}`;
  if (!end) return `${start.time} ${start.period}`;

  if (start.period === end.period) {
    return `${start.time} - ${end.time} ${end.period}`;
  }

  return `${start.time} ${start.period} - ${end.time} ${end.period}`;
}
