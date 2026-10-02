import { createAccountHelpStore } from "../../shared/account-help";

// Browser access is deferred until an event/effect; SSR never stores visitor data.
export const accountHelpStore = createAccountHelpStore(() =>
  typeof window === "undefined" ? null : window.sessionStorage,
);
