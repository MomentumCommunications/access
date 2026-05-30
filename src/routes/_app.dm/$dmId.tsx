import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/dm/$dmId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-[calc(100vh-54px)] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquareOff className="size-5 text-muted-foreground" />
            <CardTitle>Messages unavailable</CardTitle>
          </div>
          <CardDescription>
            Direct messages have been removed while the new chat experience is
            being prepared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/home">Go Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
