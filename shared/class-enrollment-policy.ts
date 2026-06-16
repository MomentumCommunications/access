export function classVisibleToStudentGroup({
  studentGroupId,
  visibleToGroupIds,
}: {
  studentGroupId?: string;
  visibleToGroupIds?: string[];
}) {
  if (!visibleToGroupIds || visibleToGroupIds.length === 0) {
    return true;
  }
  return Boolean(studentGroupId && visibleToGroupIds.includes(studentGroupId));
}

export function groupManagedEnrollment(group?: {
  managedEnrollment?: boolean;
} | null) {
  return group?.managedEnrollment === true;
}

export function studentSelfServiceEnrollmentAllowed(group?: {
  managedEnrollment?: boolean;
} | null) {
  return !groupManagedEnrollment(group);
}
