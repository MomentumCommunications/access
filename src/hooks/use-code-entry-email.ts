import { useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { accountHelpStore } from "~/lib/account-help";
import {
  parseAccountHelpContext,
  type AccountHelpContext,
} from "../../shared/account-help";

export function useCodeEntryEmail(flow: AccountHelpContext["flow"]) {
  const returnTo = useLocation({
    select: (location) => `${location.pathname}${location.searchStr}`,
  });
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const context = accountHelpStore.read();
    if (!context || context.flow !== flow) return;
    const current = parseAccountHelpContext({
      email: context.email,
      flow,
      returnTo,
    });
    if (context.returnTo === current?.returnTo) setEmail(context.email);
  }, [flow, returnTo]);

  const updateEmail = useCallback((value: string | null) => {
    accountHelpStore.clear();
    setEmail(value);
  }, []);
  return [email, updateEmail] as const;
}
