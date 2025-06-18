import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chat/general/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/chat/general/"!</div>;
}
