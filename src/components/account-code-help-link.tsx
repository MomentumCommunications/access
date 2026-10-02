import { Link, useLocation } from "@tanstack/react-router";
import type { AccountHelpContext } from "../../shared/account-help";
import { accountHelpStore } from "~/lib/account-help";

export function AccountCodeHelpLink({
  email,
  flow,
}: {
  email: string;
  flow: AccountHelpContext["flow"];
}) {
  const returnTo = useLocation({
    select: (location) => `${location.pathname}${location.searchStr}`,
  });
  return (
    <Link
      to="/account-help"
      className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      onClick={() => accountHelpStore.save({ email, flow, returnTo })}
    >
      Don’t see your code? Get help
    </Link>
  );
}
