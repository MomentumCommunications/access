import {
  useConvexAction,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  ArrowLeft,
  Ban,
  Copy,
  Home,
  HousePlus,
  Mail,
  Pencil,
  RefreshCw,
  Unlink,
  User,
  UserPlus,
} from "lucide-react";
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
import { Switch } from "~/components/ui/switch";
import { formatAge, formatFullDate } from "~/lib/date-utils";
import { getAccountName } from "~/lib/account-name";
import { RoleDropdown } from "~/components/role-controls";
import { resolveUserRoles } from "~/lib/roles";
import {
  accountStatusConfirmationCopy,
  resolveAccountStatus,
  type AccountStatus,
} from "../../../shared/account-status";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { PatternFormat } from "react-number-format";

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
  const setRoles = useConvexMutation(api.classes.adminSetUserRoles);
  const setAccountStatus = useConvexMutation(api.classes.adminSetAccountStatus);
  const [pendingStatus, setPendingStatus] = useState<AccountStatus | null>(
    null,
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const statusImpact = useConvexQuery(api.classes.adminGetAccountStatusImpact, {
    user: typedUserId,
    status: pendingStatus ?? resolveAccountStatus(accountData?.account.status),
  });

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    setSavingStatus(true);
    try {
      const result = await setAccountStatus({
        user: typedUserId,
        status: pendingStatus,
      });
      const skipped =
        result.skippedSharedStudentCount > 0
          ? ` ${result.skippedSharedStudentCount} shared student${result.skippedSharedStudentCount === 1 ? " was" : "s were"} kept active.`
          : "";
      toast.success(`Account status updated.${skipped}`);
      setPendingStatus(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update account status.",
      );
    } finally {
      setSavingStatus(false);
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
        <main className="mx-auto w-full max-w-6xl gap-4 p-4 lg:p-8">
          <section className="space-y-4">
            <div className="space-y-2">
              <Button asChild variant="ghost" className="-ml-3">
                <Link to="/admin/accounts">
                  <ArrowLeft />
                  Accounts
                </Link>
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-full">
                    <AvatarImage
                      src={accountData.account.image}
                      alt={accountData.account.name || ""}
                      className="h-full object-cover"
                    />
                    <AvatarFallback className="rounded-lg">
                      <User className="size-8" />
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-3xl font-bold">
                    {getAccountName(accountData.account)}
                  </p>
                </div>
                <Button asChild>
                  <Link
                    to="/admin/accounts/$userId/edit"
                    params={{ userId: accountData.account._id }}
                  >
                    <Pencil />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Status</div>
                  <Select
                    value={resolveAccountStatus(accountData.account.status)}
                    onValueChange={(value) => {
                      const status = value as AccountStatus;
                      if (
                        status !==
                        resolveAccountStatus(accountData.account.status)
                      ) {
                        setPendingStatus(status);
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Account status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    {accountData.account.phone ? (
                      <PatternFormat
                        value={accountData.account.phone}
                        format="+1 (###) ###-####"
                        mask="_"
                        disabled
                      />
                    ) : (
                      "Not set"
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 space-y-4">
              <HouseholdDialog userId={userId} />
              <InviteDialog userId={userId} />
            </div>
            <Separator className="my-4 w-full" />
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
                {accountData.students.map(
                  ({ contact, student, studentPic }) => (
                    <Card key={contact._id} className="rounded-lg">
                      <CardHeader>
                        <CardTitle>
                          {student ? (
                            <Button
                              asChild
                              variant="link"
                              className="h-auto p-0"
                            >
                              <Link
                                to="/admin/students/$studentId"
                                params={{ studentId: student._id }}
                              >
                                <Avatar className="h-12 w-12 rounded-full">
                                  <AvatarImage
                                    src={studentPic || undefined}
                                    alt={`${student.firstName} ${student.lastName}`}
                                    className="h-full object-cover"
                                  />
                                  <AvatarFallback className="rounded-lg">
                                    <User className="size-8" />
                                  </AvatarFallback>
                                </Avatar>
                                <p className="text-lg font-bold">
                                  {student.preferredName ||
                                    `${student.firstName} ${student.lastName}`}
                                </p>
                              </Link>
                            </Button>
                          ) : (
                            "Missing student"
                          )}
                        </CardTitle>
                        <CardDescription>
                          {contact.relationship || ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border p-3">
                          <div className="text-muted-foreground">Birthday</div>
                          <div className="font-medium">
                            {formatFullDate(student?.dateOfBirth) || "Not set"}
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
                  ),
                )}
              </div>
            )}
          </section>
        </main>
      )}
      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open && !savingStatus) setPendingStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus && accountData
                ? accountStatusConfirmationCopy({
                    status: pendingStatus,
                    householdName: statusImpact?.householdName,
                    accountName: getAccountName(accountData.account),
                  })
                : "Change account status?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "inactive"
                ? "Affected students will become inactive. Current enrollments will be dropped, requests removed, and active per-session selections cancelled."
                : "Accounts and students will become active again. Previous enrollments and session selections will not be restored."}
              {statusImpact ? (
                <>
                  {" "}
                  {statusImpact.affectedAccountCount} account
                  {statusImpact.affectedAccountCount === 1 ? "" : "s"} and{" "}
                  {statusImpact.studentCount} student
                  {statusImpact.studentCount === 1 ? "" : "s"} will change.
                  {statusImpact.skippedSharedStudentCount > 0
                    ? ` ${statusImpact.skippedSharedStudentCount} shared student${statusImpact.skippedSharedStudentCount === 1 ? " has" : "s have"} another active account and will remain active.`
                    : ""}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingStatus || !statusImpact}
              onClick={(event) => {
                event.preventDefault();
                void confirmStatusChange();
              }}
            >
              {savingStatus ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGate>
  );
}

function HouseholdDialog({ userId }: { userId: string }) {
  const typedUserId = userId as Id<"users">;
  const householdData = useConvexQuery(api.billing.adminGetAccountHousehold, {
    userId: typedUserId,
  });
  const households = useConvexQuery(api.billing.adminListHouseholds, {});

  const attachHousehold = useConvexMutation(
    api.billing.adminAttachAccountToHousehold,
  );
  const createHousehold = useConvexMutation(
    api.billing.adminCreateHouseholdForAccount,
  );
  const removeHousehold = useConvexMutation(
    api.billing.adminRemoveAccountFromHousehold,
  );
  const setPayerAutopay = useConvexMutation(
    api.billing.adminSetHouseholdPayerAutopay,
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
    <Dialog>
      <form>
        <DialogTrigger asChild>
          <Button variant="outline">
            <HousePlus className="size-4" />
            {householdData === undefined || households === undefined ? (
              <Spinner className="size-4" />
            ) : (
              <span>{householdData?.household.name || "Not assigned"}</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Household</DialogTitle>
            <DialogDescription>
              Assign this account to a household to manage tuition billing.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg">
            <div className="space-y-5">
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
                      <p className="text-muted-foreground mt-1 text-xs">
                        Until linked, billing falls back to the connected
                        account or a standalone student group.
                      </p>
                    ) : (
                      <>
                        {householdData.payer?.active &&
                        householdData.payer.isPrimary ? (
                          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                            <div>
                              <Label htmlFor="account-autopay">
                                Automatic payment
                              </Label>
                              <p className="text-muted-foreground text-xs">
                                Auto-charge draft invoices only when Stripe has
                                a default payment method.
                              </p>
                            </div>
                            <Switch
                              id="account-autopay"
                              checked={
                                householdData.payer.autopayEnabled === true
                              }
                              onCheckedChange={(enabled) => {
                                void setPayerAutopay({
                                  householdPayerId: householdData.payer!._id,
                                  enabled,
                                }).catch((error) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Unable to update autopay.",
                                  ),
                                );
                              }}
                            />
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive -ml-2 mt-2"
                          disabled={savingHousehold}
                          onClick={() => void handleRemoveHousehold()}
                        >
                          <Unlink />
                          Remove link
                        </Button>
                      </>
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
                        disabled={!newHouseholdName.trim() || savingHousehold}
                      >
                        Create
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </form>
    </Dialog>
  );
}

function InviteDialog({ userId }: { userId: string }) {
  const typedUserId = userId as Id<"users">;
  const accountData = useConvexQuery(api.classes.adminGetAccount, {
    user: typedUserId,
  });

  const invitationStatus = useConvexQuery(api.invitations.adminGetStatus, {
    targetUserId: typedUserId,
  });
  const sendInvitation = useConvexAction(api.invitationActions.send);
  const createInvitationLink = useConvexAction(
    api.invitationActions.createLink,
  );
  const revokeInvitation = useConvexMutation(api.invitations.revoke);
  const [savingInvitation, setSavingInvitation] = useState(false);

  async function handleInvitation(operation: "send" | "copy") {
    setSavingInvitation(true);
    try {
      const invitation =
        operation === "send"
          ? await sendInvitation({ targetUserId: typedUserId })
          : await createInvitationLink({ targetUserId: typedUserId });
      if (operation === "copy" || "warning" in invitation) {
        await navigator.clipboard.writeText(invitation.url);
      }
      if ("warning" in invitation && invitation.warning) {
        toast.warning(`${invitation.warning} The link was copied.`);
      } else {
        toast.success(
          operation === "send"
            ? "Invitation sent."
            : "A new invitation link was copied.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create invitation.",
      );
    } finally {
      setSavingInvitation(false);
    }
  }

  async function handleRevokeInvitation() {
    const invitation = invitationStatus?.latestInvitation;
    if (!invitation) return;
    setSavingInvitation(true);
    try {
      await revokeInvitation({ invitationId: invitation._id });
      toast.success("Invitation revoked.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to revoke invitation.",
      );
    } finally {
      setSavingInvitation(false);
    }
  }

  if (!accountData) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="rounded-lg">
          <div className="space-y-4">
            {invitationStatus === undefined ? (
              <Spinner className="size-4" />
            ) : invitationStatus?.hasLogin ? (
              <p className="text-muted-foreground text-sm">
                This account already has login credentials. Manage access with
                the role controls above.
              </p>
            ) : (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {invitationStatus?.latestInvitation?.effectiveStatus ||
                      "Not invited"}
                  </div>
                  {invitationStatus?.latestInvitation ? (
                    <div className="text-muted-foreground mt-1 text-xs">
                      Expires{" "}
                      {new Date(
                        invitationStatus.latestInvitation.expiresAt,
                      ).toLocaleString()}
                    </div>
                  ) : null}
                </div>
                {resolveUserRoles(accountData.account).includes("member") &&
                !resolveUserRoles(accountData.account).some(
                  (role) => role === "staff" || role === "admin",
                ) &&
                invitationStatus &&
                (invitationStatus.billing.householdMembershipCount === 0 ||
                  invitationStatus.billing.payerCount === 0 ||
                  !invitationStatus.billing.hasStripeCustomer) ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    This member account is missing some pre-provisioned billing
                    setup. Activation will preserve the current records and will
                    not guess or replace them.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={savingInvitation}
                    onClick={() => void handleInvitation("send")}
                  >
                    {invitationStatus?.latestInvitation?.effectiveStatus ===
                    "pending" ? (
                      <RefreshCw />
                    ) : (
                      <Mail />
                    )}
                    {invitationStatus?.latestInvitation?.effectiveStatus ===
                    "pending"
                      ? "Resend"
                      : "Send invitation"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingInvitation}
                    onClick={() => void handleInvitation("copy")}
                  >
                    <Copy />
                    Copy new link
                  </Button>
                  {invitationStatus?.latestInvitation?.effectiveStatus ===
                  "pending" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={savingInvitation}
                      onClick={() => void handleRevokeInvitation()}
                    >
                      <Ban />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
