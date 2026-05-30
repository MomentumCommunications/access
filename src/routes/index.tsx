import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: PublicHome,
});

function PublicHome() {
  return <Navigate to="/home" replace />;
}
