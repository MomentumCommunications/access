import { z } from "zod";

export const accountHelpFlows = [
  "signup",
  "login",
  "password_reset",
  "account_password_reset",
  "unknown",
] as const;
export type AccountHelpFlow = (typeof accountHelpFlows)[number];
export const accountHelpFlowLabels: Record<AccountHelpFlow, string> = {
  signup: "Account registration",
  login: "Sign-in email verification",
  password_reset: "Password reset",
  account_password_reset: "Password change from account settings",
  unknown: "Account access",
};

export const accountHelpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name.")
    .max(120, "Keep your name under 120 characters."),
  email: z
    .string()
    .trim()
    .max(254)
    .email("Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(40, "Keep your phone number under 40 characters.")
    .optional(),
  message: z
    .string()
    .trim()
    .max(5000, "Keep your message under 5,000 characters.")
    .optional(),
  flow: z.enum(accountHelpFlows),
});

export const ACCOUNT_HELP_WINDOW_MS = 60 * 60 * 1000;
export const ACCOUNT_HELP_COOLDOWN_MS = 60 * 1000;
export function reserveAccountHelpAttempts(
  emailAttempts: number[],
  globalAttempts: number[],
  now: number,
) {
  const recent = (attempts: number[]) =>
    attempts.filter((at) => at > now - ACCOUNT_HELP_WINDOW_MS);
  const email = recent(emailAttempts);
  const global = recent(globalAttempts);
  if (email.some((at) => now - at < ACCOUNT_HELP_COOLDOWN_MS)) {
    throw new Error("Please wait a minute before sending another request.");
  }
  if (email.length >= 5 || global.length >= 30) {
    throw new Error(
      "We’ve received too many requests recently. Please try again in an hour.",
    );
  }
  return { email: [...email, now], global: [...global, now] };
}

const contextSchema = z.object({
  email: z.string().trim().min(1).max(254),
  flow: z.enum(accountHelpFlows).exclude(["unknown"]),
  returnTo: z.string().max(4096),
});
export type AccountHelpContext = z.infer<typeof contextSchema>;

// Only these authentication routes may restore a code-entry step. Extra fields
// (including any accidentally supplied password or code) are never persisted.
export function parseAccountHelpContext(
  input: unknown,
): AccountHelpContext | null {
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, flow, returnTo } = parsed.data;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  try {
    const url = new URL(returnTo, "https://access.invalid");
    if (url.origin !== "https://access.invalid") return null;
    const path = url.pathname.replace(/\/$/, "");
    const expected =
      flow === "signup"
        ? "/register"
        : flow === "login"
          ? "/login"
          : "/reset-password";
    if (path !== expected) return null;
    const allowed =
      flow === "signup"
        ? ["invite", "referral", "redirect"]
        : flow === "login"
          ? ["redirect"]
          : ["accountChallenge"];
    for (const key of [...url.searchParams.keys()]) {
      if (!allowed.includes(key)) url.searchParams.delete(key);
    }
    const challenge = url.searchParams.get("accountChallenge");
    if ((flow === "account_password_reset") !== Boolean(challenge)) return null;
    return { email, flow, returnTo: `${url.pathname}${url.search}` };
  } catch {
    return null;
  }
}

type HelpStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const ACCOUNT_HELP_STORAGE_KEY = "access:account-help";
export function createAccountHelpStore(getStorage: () => HelpStorage | null) {
  let memory: AccountHelpContext | null = null;
  // Once storage is unavailable, prefer the in-memory state over possibly stale
  // persisted values for the rest of this page's lifetime (including after clear).
  let storageUnavailable = false;
  return {
    save(input: AccountHelpContext) {
      memory = parseAccountHelpContext(input);
      try {
        if (!storageUnavailable) {
          const storage = getStorage();
          if (memory)
            storage?.setItem(ACCOUNT_HELP_STORAGE_KEY, JSON.stringify(memory));
          else storage?.removeItem(ACCOUNT_HELP_STORAGE_KEY);
        }
      } catch {
        storageUnavailable = true;
      }
    },
    read() {
      try {
        if (!storageUnavailable) {
          const stored = getStorage()?.getItem(ACCOUNT_HELP_STORAGE_KEY);
          if (stored) memory = parseAccountHelpContext(JSON.parse(stored));
        }
      } catch {
        storageUnavailable = true;
      }
      return memory;
    },
    clear() {
      memory = null;
      try {
        if (!storageUnavailable)
          getStorage()?.removeItem(ACCOUNT_HELP_STORAGE_KEY);
      } catch {
        storageUnavailable = true;
      }
    },
  };
}
