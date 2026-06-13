import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Home, Unlink, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { formatAge } from "~/lib/date-utils";
import { getAccountName } from "~/lib/account-name";
import { RoleDropdown } from "~/components/role-controls";
import { resolveUserRoles } from "~/lib/roles";

export const Route = createFileRoute("/_app/admin/accounts_/$userId")({
  component: AdminAccountDetailPage,
});

function formatEmail(email?: string | string[]) {
  if (Array.isArray(email)) return email.join(", ");
  return email || "Not set";
}

function AdminAccountDetailPage() {
  const { userId } = Route.useParams();
  const typedUserId = userId as Id<"users">;
  const accountData = useConvexQuery(api.classes.adminGetAccount, {
    user: typedUserId,
  });
  const householdData = useConvexQuery(
    api.billing.adminGetAccountHousehold,
    { userId: typedUserId },
  );
  const households = useConvexQuery(api.billing.adminListHouseholds, {});
  const setRoles = useConvexMutation(api.classes.adminSetUserRoles);
  const attachHousehold = useConvexMutation(
    api.billing.adminAttachAccountToHousehold,
  );
  const createHousehold = useConvexMutation(
    api.billing.adminCreateHouseholdForAccount,
  );
  const removeHousehold = useConvexMutation(
    api.billing.adminRemoveAccountFromHousehold,
  );
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [savingHousehold, setSavingHousehold] = useState(false);

  async function handleAttachHousehold() {
    if (!selectedHouseholdId) return;
    setSavingHousehold(true);
    try {
      await attachHousehold({
        userId: typedUserId,
        householdId: selectedHouseholdId as Id<"households">,
      });
      setSelectedHouseholdId("");
      toast.success("Account attached to household.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to attach household.",
      );
    } finally {
      setSavingHousehold(false);
    }
  }

  async function handleCreateHousehold() {
    if (!newHouseholdName.trim()) return;
    setSavingHousehold(true);
    try {
      await createHousehold({
        userId: typedUserId,
        name: newHouseholdName,
      });
      setNewHouseholdName("");
      toast.success("Household created and attached.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create household.",
      );
    } finally {
      setSavingHousehold(false);
    }
  }

  async function handleRemoveHousehold() {
    setSavingHousehold(true);
    try {
      await removeHousehold({ userId: typedUserId });
      toast.success("Account removed from household.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove household.",
      );
    } finally {
      setSavingHousehold(false);
    }
  }

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
                <CardTitle>{getAccountName(accountData.account)}</CardTitle>
                <CardDescription>
                  Manage account details and assigned roles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Roles</div>
                  <RoleDropdown
                    roles={resolveUserRoles(accountData.account)}
                    onRolesChange={(roles) =>
                      void setRoles({ user: accountData.account._id, roles })
                    }
                  />
                </div>
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
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="size-4" />
                  Household
                </CardTitle>
                <CardDescription>
                  Household membership groups regular tuition for billing
                  review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {householdData === undefined || households === undefined ? (
                  <Spinner className="size-4" />
                ) : (
                  <>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground">
                        Current household
                      </div>
                      <div className="font-medium">
                        {householdData?.household.name || "Not assigned"}
                      </div>
                      {!householdData ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Until linked, billing falls back to the connected
                          account or a standalone student group.
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 mt-2 text-destructive"
                          disabled={savingHousehold}
                          onClick={() => void handleRemoveHousehold()}
                        >
                          <Unlink />
                          Remove link
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="existing-household">
                        Attach existing household
                      </Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                          value={selectedHouseholdId}
                          onValueChange={setSelectedHouseholdId}
                          disabled={households.length === 0}
                        >
                          <SelectTrigger
                            id="existing-household"
                            className="min-w-0 flex-1"
                          >
                            <SelectValue
                              placeholder={
                                households.length === 0
                                  ? "No households yet"
                                  : "Select household"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {households.map(({ household, memberCount }) => (
                              <SelectItem
                                key={household._id}
                                value={household._id}
                              >
                                {household.name} ({memberCount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          disabled={!selectedHouseholdId || savingHousehold}
                          onClick={() => void handleAttachHousehold()}
                        >
                          Attach
                        </Button>
                      </div>
                    </div>

                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleCreateHousehold();
                      }}
                    >
                      <Label htmlFor="new-household-name">
                        Create a household
                      </Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          id="new-household-name"
                          value={newHouseholdName}
                          onChange={(event) =>
                            setNewHouseholdName(event.target.value)
                          }
                          placeholder="Household name"
                          maxLength={100}
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          disabled={
                            !newHouseholdName.trim() || savingHousehold
                          }
                        >
                          Create
                        </Button>
                      </div>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">Connected students</h1>
                <p className="text-muted-foreground">
                  Student profiles linked to this account.
                </p>
              </div>
              <Button asChild className="w-full sm:w-auto">
                <Link
                  to="/admin/accounts/$userId/students/create"
                  params={{ userId: accountData.account._id }}
                >
                  <UserPlus />
                  Add student
                </Link>
              </Button>
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
