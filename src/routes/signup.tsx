import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
  component: SignupRoute,
});

function SignupRoute() {
  return <Navigate to="/register" replace />;
}
