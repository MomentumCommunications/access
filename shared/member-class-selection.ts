export function resolveManagedStudentId(
  requestedStudentId: string | undefined,
  managedStudentIds: readonly string[],
) {
  if (
    requestedStudentId &&
    managedStudentIds.includes(requestedStudentId)
  ) {
    return requestedStudentId;
  }

  return managedStudentIds[0];
}
