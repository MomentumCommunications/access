import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invite/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/register",
      search: { invite: params.token },
      replace: true,
    });
  },
});
