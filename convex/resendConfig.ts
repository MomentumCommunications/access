export function getResendApiKey() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    throw new Error(
      "Missing RESEND_API_KEY. Set it in Convex environment variables.",
    );
  }

  return resendApiKey;
}

export const resendFromAddress =
  "Access Momentum <noreply@notifs.access.momentumdanceavl.com>";
