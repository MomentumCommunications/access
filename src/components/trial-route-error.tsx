import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { CircleAlert, MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function TrialRouteError({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : "";
  const accountSetupIssue =
    message.includes("onboarding") ||
    message.includes("agreement") ||
    message.includes("household") ||
    message.includes("billing setup");

  return (
    <main className="mx-auto flex w-full max-w-2xl p-4 lg:p-8">
      <Card className="w-full rounded-lg">
        <CardHeader>
          <CircleAlert className="mb-2 size-8 text-muted-foreground" />
          <CardTitle>We couldn&apos;t load paid trials</CardTitle>
          <CardDescription>
            {accountSetupIssue
              ? "This account may need a quick setup update before it can request a paid trial."
              : "Something prevented the trial options from loading. You can try again or ask the studio for help."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link to="/contact" search={{ topic: "account_access" }}>
              <MessageCircle />
              Contact the studio
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
