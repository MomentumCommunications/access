import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Header } from "~/components/header";

export const Route = createFileRoute("/admin/")({
  component: RouteComponent,
  loader: async () => {
    const user = useUser();

    if (!user) {
      return null;
    }

    return user;
  },
});

function RouteComponent() {
  const user = Route.useLoaderData();

  console.log(user);

  console.log("see here");

  if (!user) {
    return null;
  }

  const userId = user.user?.publicMetadata.convexId;

  if (user.user?.publicMetadata.convexId === undefined) {
    return (
      <>
        <Header
          breadcrumbs={[{ title: "Home", url: "/" }]}
          currentPage="Admin"
        />
        <div>
          <h1>Unauthorized</h1>
        </div>
        <p>You are not authorized to access this page.</p>
        <a href="/">Go Home</a>
      </>
    );
  }

  const { data: convexUser, isLoading } = useQuery(
    convexQuery(api.users.getUserById, {
      id: userId as Id<"users">,
    }),
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (convexUser?.role !== "admin") {
    return (
      <>
        <Header
          breadcrumbs={[{ title: "Home", url: "/" }]}
          currentPage="Admin"
        />
        <div>
          <h1>Unauthorized</h1>
        </div>
        <p>You are not authorized to access this page.</p>
        <a href="/">Go Home</a>
      </>
    );
  }

  return (
    <>
      <Header breadcrumbs={[{ title: "Home", url: "/" }]} currentPage="Admin" />
      <div>
        <h1>Admin</h1>
      </div>
    </>
  );
}
