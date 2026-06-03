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
