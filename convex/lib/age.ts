export function calculateAgeOnDate(
  dateOfBirth: string | undefined,
  date: string,
) {
  const birth = parseDateValue(dateOfBirth);
  const current = parseDateValue(date);
  if (!birth || !current) {
    return null;
  }

  let age = current.year - birth.year;
  if (
    current.month < birth.month ||
    (current.month === birth.month && current.day < birth.day)
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function parseDateValue(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    return null;
  }

  return { year, month, day };
}

export function classMatchesAge(
  classItem: { minAge?: number; maxAge?: number },
  age: number | null,
) {
  if (age === null) {
    return classItem.minAge === undefined && classItem.maxAge === undefined;
  }

  return (
    (classItem.minAge === undefined || age >= classItem.minAge) &&
    (classItem.maxAge === undefined || age <= classItem.maxAge)
  );
}
