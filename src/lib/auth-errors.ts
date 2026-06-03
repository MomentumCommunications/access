export function getAuthErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid password") ||
    normalized.includes("invalidsecret") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("invalididentifierorsecret") ||
    normalized.includes("credentials signin")
  ) {
    return "The email or password you entered is incorrect.";
  }

  if (
    normalized.includes("invalid verification") ||
    normalized.includes("invalid code") ||
    normalized.includes("invalidtoken") ||
    normalized.includes("verification failed")
  ) {
    return "That code is incorrect or has expired. Please check it and try again.";
  }

  if (
    normalized.includes("already") &&
    (normalized.includes("exists") || normalized.includes("registered"))
  ) {
    return "An account already exists for that email address.";
  }

  if (normalized.includes("password") && normalized.includes("short")) {
    return "Please use a password with at least 8 characters.";
  }

  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Could not connect. Please check your connection and try again.";
  }

  return fallback;
}
