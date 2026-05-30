import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/help")({
  component: HelpRoute,
});

function HelpRoute() {
  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Help</CardTitle>
          <CardDescription>
            Access Momentum is currently focused on bulletins, account
            settings, directory access, and group information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Chat and direct messaging are temporarily unavailable while the new
            chat experience is being prepared.
          </p>
          <p>
            For help with account access or portal content, contact your system
            administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
