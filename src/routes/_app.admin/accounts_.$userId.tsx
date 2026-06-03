import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ArrowLeft } from "lucide-react";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { formatAge } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/accounts_/$userId")({
  component: AdminAccountDetailPage,
});

function formatEmail(email?: string | string[]) {
  if (Array.isArray(email)) return email.join(", ");
  return email || "Not set";
}

function AdminAccountDetailPage() {
  const { userId } = Route.useParams();
  const accountData = useConvexQuery(api.classes.adminGetAccount, {
    user: userId as Id<"users">,
  });

  return (
    <RoleGate allow="admin">
      {accountData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !accountData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Account not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[22rem_1fr] lg:p-8">
          <section className="space-y-4">
            <div className="space-y-2">
              <Button asChild variant="ghost" className="-ml-3">
                <Link to="/admin/accounts">
                  <ArrowLeft />
                  Accounts
                </Link>
              </Button>
            </div>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>{accountData.account.name || "Unnamed"}</CardTitle>
                <CardDescription className="capitalize">
                  {accountData.account.role || "member"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium">
                    {formatEmail(accountData.account.email)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Phone</div>
                  <div className="font-medium">
                    {accountData.account.phone || "Not set"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
          <section className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold">Connected students</h1>
              <p className="text-muted-foreground">
                Student profiles linked to this account.
              </p>
            </div>
            {accountData.students.length === 0 ? (
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>No connected students</CardTitle>
                  <CardDescription>
                    This account is not linked to any student profiles.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {accountData.students.map(({ contact, student }) => (
                  <Card key={contact._id} className="rounded-lg">
                    <CardHeader>
                      <CardTitle>
                        {student ? (
                          <Button asChild variant="link" className="h-auto p-0">
                            <Link
                              to="/admin/students/$studentId"
                              params={{ studentId: student._id }}
                            >
                              {student.preferredName ||
                                `${student.firstName} ${student.lastName}`}
                            </Link>
                          </Button>
                        ) : (
                          "Missing student"
                        )}
                      </CardTitle>
                      <CardDescription>
                        {contact.relationship || "Relationship not set"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border p-3">
                        <div className="text-muted-foreground">Birthday</div>
                        <div className="font-medium">
                          {student?.dateOfBirth || "Not set"}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-muted-foreground">Age</div>
                        <div className="font-medium">
                          {formatAge(student?.dateOfBirth)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>
      )}
    </RoleGate>
  );
}
