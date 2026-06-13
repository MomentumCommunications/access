import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_app/admin/billing/private-charges",
)({
  beforeLoad: () => {
    throw redirect({ to: "/admin/billing/charges" });
  },
});
