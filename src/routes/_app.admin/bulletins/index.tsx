import { createFileRoute } from "@tanstack/react-router";
import { AddBulletin } from "~/components/add-bulletin";
import { AdminBulletin } from "~/components/admin-bulletin";
import { Separator } from "~/components/ui/separator";

export const Route = createFileRoute("/_app/admin/bulletins/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 p-4 lg:p-8">
      <div className="flex pt-12 justify-between align-middle">
        <h1 className="text-4xl font-bold">Bulletin</h1>
        <AddBulletin />
      </div>
      <Separator className="my-4 w-full" />
      <AdminBulletin />
    </div>
  );
}
