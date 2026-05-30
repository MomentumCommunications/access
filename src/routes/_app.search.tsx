import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/search")({
  component: SearchRoute,
});

function SearchRoute() {
  return (
    <div className="flex min-h-[calc(100vh-54px)] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SearchX className="size-5 text-muted-foreground" />
            <CardTitle>Search unavailable</CardTitle>
          </div>
          <CardDescription>
            Message search has been removed with the old chat implementation.
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
