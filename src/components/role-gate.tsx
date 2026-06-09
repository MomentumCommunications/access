import { CircleSlash } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCurrentUser } from "~/hooks/useCurrentUser";
import { canAccessAdmin, canAccessStaff } from "~/lib/roles";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

type RoleGateProps = {
  allow: "admin" | "staff";
  children: ReactNode;
};

export function RoleGate({ allow, children }: RoleGateProps) {
  const { data: user, isLoading } = useCurrentUser();
  const allowed =
    allow === "admin" ? canAccessAdmin(user) : canAccessStaff(user);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
        <Spinner className="size-5" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-[calc(100svh-54px)] items-center justify-center p-4">
        <Alert className="max-w-md">
          <CircleSlash />
          <AlertTitle>Unauthorized</AlertTitle>
          <AlertDescription>
            You are not authorized to view this page.
          </AlertDescription>
          <AlertDescription className="pt-2">
            <Button asChild variant="outline">
              <Link to="/home">Go Home</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return <>{children}</>;
}
