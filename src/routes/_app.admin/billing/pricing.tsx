import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Copy, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  formatPercentFromBasisPoints,
  parseCurrencyToCents,
  parsePercentToBasisPoints,
  type NormalizedTuitionTier,
  type SiblingDiscountConfig,
} from "../../../../shared/tuition-pricing";
import { RoleGate } from "~/components/role-gate";
import { TuitionTierGrid } from "~/components/tuition-tier-grid";
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
import { Badge } from "~/components/ui/badge";
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
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_app/admin/billing/pricing")({
  component: PricingPage,
});

type PricingSchemaListItem =
  FunctionReturnType<typeof api.billing.adminListPricingSchemas>[number];

function statusBadgeVariant(status: PricingSchemaListItem["schema"]["status"]) {
  if (status === "active") return "default" as const;
  if (status === "draft") return "secondary" as const;
  return "outline" as const;
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function PricingPage() {
  return (
    <RoleGate allow="admin">
      <PricingAdminPage />
    </RoleGate>
  );
}

function PricingAdminPage() {
  const schemas = useConvexQuery(api.billing.adminListPricingSchemas, {});
  const [selectedSchemaId, setSelectedSchemaId] =
    useState<Id<"pricingSchemas"> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createSchema = useConvexMutation(
    api.billing.adminCreatePricingSchema,
  );

  useEffect(() => {
    if (!schemas?.length) {
      setSelectedSchemaId(null);
      return;
    }
    if (
      selectedSchemaId &&
      schemas.some(({ schema }) => schema._id === selectedSchemaId)
    ) {
      return;
    }
    setSelectedSchemaId(
      (schemas.find(({ schema }) => schema.status === "draft") || schemas[0])
        .schema._id,
    );
  }, [schemas, selectedSchemaId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!newSchemaName.trim()) return;
    setIsCreating(true);
    try {
      const pricingSchemaId = await createSchema({ name: newSchemaName });
      setSelectedSchemaId(pricingSchemaId);
      setNewSchemaName("");
      setShowCreate(false);
      toast.success("Pricing schema created.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The pricing schema could not be created.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Pricing</h1>
            <p className="text-muted-foreground">
              Configure recurring tuition and app-calculated charge rates.
            </p>
          </div>
          <Button type="button" onClick={() => setShowCreate(true)}>
            <Plus />
            Add schema
          </Button>
        </div>

        {showCreate ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-base">New pricing schema</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={handleCreate}
              >
                <Input
                  autoFocus
                  value={newSchemaName}
                  placeholder="Schema name"
                  maxLength={100}
                  onChange={(event) => setNewSchemaName(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={!newSchemaName.trim() || isCreating}
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      setNewSchemaName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {schemas === undefined ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : schemas.length === 0 ? (
          <Card className="rounded-lg">
            <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <div>
                <p className="font-medium">No pricing schemas yet</p>
                <p className="text-sm text-muted-foreground">
                  Create a draft to begin entering tuition tiers.
                </p>
              </div>
              <Button type="button" onClick={() => setShowCreate(true)}>
                <Plus />
                Add schema
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <Card className="h-min rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Pricing schemas</CardTitle>
                <CardDescription>
                  Drafts can be edited. Active and archived versions are locked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {schemas.map(({ schema, tierCount }) => (
                  <button
                    key={schema._id}
                    type="button"
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50",
                      selectedSchemaId === schema._id &&
                        "border-primary bg-muted/50",
                    )}
                    onClick={() => setSelectedSchemaId(schema._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {schema.name}
                      </span>
                      <Badge variant={statusBadgeVariant(schema.status)}>
                        {schema.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Version {schema.version} · {tierCount}{" "}
                      {tierCount === 1 ? "tier" : "tiers"}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedSchemaId ? (
              <PricingSchemaEditor
                pricingSchemaId={selectedSchemaId}
                onSelectSchema={setSelectedSchemaId}
              />
            ) : null}
          </div>
        )}

        <PrivatePricingSection />

        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Packages", "Reserved for package-based pricing."],
            ["Adjustments", "Reserved for scholarships and manual changes."],
          ].map(([title, description]) => (
            <Card key={title} className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
    </main>
  );
}

const privateParticipantLabels = {
  1: "Solo",
  2: "Duet",
  3: "Trio",
} as const;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function PrivatePricingSection() {
  const rates = useConvexQuery(api.billing.adminListPrivateRates, {});
  const createRate = useConvexMutation(api.billing.adminCreatePrivateRate);
  const deactivateRate = useConvexMutation(
    api.billing.adminDeactivatePrivateRate,
  );
  const [participants, setParticipants] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [hourlyPrice, setHourlyPrice] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] =
    useState<Id<"privateRates"> | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const hourlyPriceCents = parseCurrencyToCents(hourlyPrice);
    if (hourlyPriceCents === null) {
      setError("Enter a valid nonnegative hourly rate.");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      await createRate({
        participants,
        hourlyPriceCents,
        name: name.trim() || undefined,
      });
      setName("");
      setHourlyPrice("");
      toast.success(
        `${privateParticipantLabels[participants]} private rate activated.`,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The private rate could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate(privateRateId: Id<"privateRates">) {
    setDeactivatingId(privateRateId);
    try {
      await deactivateRate({ privateRateId });
      toast.success("Private rate deactivated.");
    } catch (deactivateError) {
      toast.error(
        deactivateError instanceof Error
          ? deactivateError.message
          : "The private rate could not be deactivated.",
      );
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Private Pricing</CardTitle>
        <CardDescription>
          Hourly per-student rates based on a private&apos;s default participant
          count. New rates replace the active version without changing saved
          historical charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-[10rem_minmax(0,1fr)_12rem_auto] lg:items-end"
          onSubmit={handleCreate}
        >
          <div className="space-y-2">
            <Label htmlFor="private-rate-participants">Rate bucket</Label>
            <select
              id="private-rate-participants"
              value={participants}
              disabled={isSaving}
              onChange={(event) =>
                setParticipants(Number(event.target.value) as 1 | 2 | 3)
              }
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              {[1, 2, 3].map((count) => (
                <option key={count} value={count}>
                  {privateParticipantLabels[count as 1 | 2 | 3]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="private-rate-name">Name</Label>
            <Input
              id="private-rate-name"
              value={name}
              maxLength={80}
              disabled={isSaving}
              placeholder={`${privateParticipantLabels[participants]} rate`}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="private-rate-price">Per student / hour</Label>
            <Input
              id="private-rate-price"
              value={hourlyPrice}
              inputMode="decimal"
              disabled={isSaving}
              placeholder="$0.00"
              aria-invalid={!!error}
              onChange={(event) => {
                setHourlyPrice(event.target.value);
                setError("");
              }}
            />
          </div>
          <Button type="submit" disabled={isSaving || !hourlyPrice.trim()}>
            {isSaving ? "Saving..." : "Add rate version"}
          </Button>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          ) : null}
        </form>

        {rates === undefined ? (
          <div className="flex min-h-24 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : rates.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="font-medium">No private rates configured</p>
            <p className="text-sm text-muted-foreground">
              Add solo, duet, and trio hourly rates to calculate private
              charges.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Hourly rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate._id}>
                    <TableCell className="font-medium">
                      {privateParticipantLabels[rate.participants]}
                    </TableCell>
                    <TableCell>{rate.name}</TableCell>
                    <TableCell>
                      {formatCurrency(rate.hourlyPriceCents)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.active ? "default" : "outline"}>
                        {rate.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatUpdatedAt(rate.activatedAt)}</TableCell>
                    <TableCell className="text-right">
                      {rate.active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={deactivatingId === rate._id}
                          onClick={() => void handleDeactivate(rate._id)}
                        >
                          {deactivatingId === rate._id
                            ? "Deactivating..."
                            : "Deactivate"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {rate.inactivatedAt
                            ? `Ended ${formatUpdatedAt(rate.inactivatedAt)}`
                            : "Historical"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PricingSchemaEditor({
  pricingSchemaId,
  onSelectSchema,
}: {
  pricingSchemaId: Id<"pricingSchemas">;
  onSelectSchema: (pricingSchemaId: Id<"pricingSchemas">) => void;
}) {
  const detail = useConvexQuery(api.billing.adminGetPricingSchema, {
    pricingSchemaId,
  });
  const saveSchema = useConvexMutation(api.billing.adminSavePricingSchema);
  const duplicateSchema = useConvexMutation(
    api.billing.adminDuplicatePricingSchema,
  );
  const activateSchema = useConvexMutation(
    api.billing.adminActivatePricingSchema,
  );
  const deleteSchema = useConvexMutation(
    api.billing.adminDeletePricingSchema,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSiblingDirty, setIsSiblingDirty] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  if (detail === undefined) {
    return (
      <Card className="rounded-lg">
        <CardContent className="flex min-h-64 items-center justify-center">
          <Spinner className="size-5" />
        </CardContent>
      </Card>
    );
  }
  if (detail === null) {
    return (
      <Card className="rounded-lg">
        <CardContent className="py-10 text-center text-muted-foreground">
          Pricing schema not found.
        </CardContent>
      </Card>
    );
  }

  const { schema } = detail;
  const tiers: NormalizedTuitionTier[] = detail.tiers.map((tier) => ({
    label: tier.label,
    maxWeeklyMinutes: tier.maxWeeklyMinutes,
    monthlyAmountCents: tier.monthlyAmountCents,
    sortOrder: tier.sortOrder,
  }));
  const isDraft = schema.status === "draft";

  async function handleSave(nextTiers: NormalizedTuitionTier[]) {
    setIsSaving(true);
    try {
      await saveSchema({ pricingSchemaId, tiers: nextTiers });
      toast.success("Pricing schema saved.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The pricing schema could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDuplicate() {
    setIsDuplicating(true);
    try {
      const duplicateId = await duplicateSchema({ pricingSchemaId });
      onSelectSchema(duplicateId);
      toast.success("Editable draft created.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The pricing schema could not be duplicated.",
      );
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleActivate() {
    setIsActivating(true);
    try {
      await activateSchema({ pricingSchemaId });
      setShowActivate(false);
      toast.success("Pricing schema activated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The pricing schema could not be activated.",
      );
    } finally {
      setIsActivating(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteSchema({ pricingSchemaId });
      setShowDelete(false);
      toast.success("Draft pricing schema deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The pricing schema could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card className="min-w-0 rounded-lg">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{schema.name}</CardTitle>
                <Badge variant={statusBadgeVariant(schema.status)}>
                  {schema.status}
                </Badge>
              </div>
              <CardDescription>
                Version {schema.version} · Updated{" "}
                {formatUpdatedAt(schema.updatedAt)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isDirty || isSiblingDirty || tiers.length === 0
                    }
                    onClick={() => setShowActivate(true)}
                  >
                    Activate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowDelete(true)}
                  >
                    Delete
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDuplicating}
                  onClick={handleDuplicate}
                >
                  <Copy />
                  {isDuplicating ? "Duplicating..." : "Duplicate"}
                </Button>
              )}
            </div>
          </div>
          {isDraft && (isDirty || isSiblingDirty) ? (
            <p className="text-sm text-muted-foreground">
              Save changes before activating this schema.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <TuitionTierGrid
            key={`${schema._id}-${schema.updatedAt}`}
            tiers={tiers}
            readOnly={!isDraft}
            isSaving={isSaving}
            onSave={handleSave}
            onDirtyChange={setIsDirty}
          />
          <SiblingDiscountEditor
            key={`sibling-${schema._id}-${schema.updatedAt}`}
            pricingSchemaId={schema._id}
            config={
              schema.siblingDiscount || {
                enabled: false,
                percentOffBasisPoints: 0,
                appliesTo: "all_but_highest",
              }
            }
            readOnly={!isDraft}
            onDirtyChange={setIsSiblingDirty}
          />
        </CardContent>
      </Card>

      <AlertDialog open={showActivate} onOpenChange={setShowActivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate this pricing schema?</AlertDialogTitle>
            <AlertDialogDescription>
              The current active schema will be archived. This version will
              become read-only so future billing runs can reference it safely.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActivating}
              onClick={(event) => {
                event.preventDefault();
                void handleActivate();
              }}
            >
              {isActivating ? "Activating..." : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft and all of its tuition tiers. Active and
              archived schemas cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SiblingDiscountEditor({
  pricingSchemaId,
  config,
  readOnly,
  onDirtyChange,
}: {
  pricingSchemaId: Id<"pricingSchemas">;
  config: SiblingDiscountConfig;
  readOnly: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const saveSiblingDiscount = useConvexMutation(
    api.billing.adminSaveSiblingDiscount,
  );
  const [enabled, setEnabled] = useState(config.enabled);
  const [percent, setPercent] = useState(
    formatPercentFromBasisPoints(config.percentOffBasisPoints),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const parsedPercent = parsePercentToBasisPoints(percent);
  const hasChanges =
    enabled !== config.enabled ||
    parsedPercent !== config.percentOffBasisPoints;

  useEffect(() => {
    onDirtyChange(hasChanges);
    return () => onDirtyChange(false);
  }, [hasChanges, onDirtyChange]);

  async function handleSave() {
    const percentOffBasisPoints = parsePercentToBasisPoints(percent);
    if (percentOffBasisPoints === null) {
      setError("Enter a percentage from 0 to 100 with up to two decimals.");
      return;
    }
    if (enabled && percentOffBasisPoints === 0) {
      setError("An enabled sibling discount must be greater than 0%.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await saveSiblingDiscount({
        pricingSchemaId,
        siblingDiscount: {
          enabled,
          percentOffBasisPoints,
          appliesTo: "all_but_highest",
        },
      });
      toast.success("Sibling discount saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The sibling discount could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-6 border-t pt-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Sibling discount</h3>
            <p className="text-sm text-muted-foreground">
              Keep the highest tuition at full price and discount every
              additional tuition-bearing student in the household.
            </p>
          </div>
          <Switch
            aria-label="Enable sibling discount"
            checked={enabled}
            disabled={readOnly || isSaving}
            onCheckedChange={setEnabled}
          />
        </div>
        <div className="max-w-xs space-y-2">
          <Label htmlFor={`sibling-percent-${pricingSchemaId}`}>
            Discount percent
          </Label>
          <div className="relative">
            <Input
              id={`sibling-percent-${pricingSchemaId}`}
              inputMode="decimal"
              value={percent}
              disabled={readOnly || isSaving}
              aria-invalid={!!error}
              onChange={(event) => {
                setPercent(event.target.value);
                setError("");
              }}
              className="pr-9"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Supports up to two decimal places.
            </p>
          )}
        </div>
        {!readOnly ? (
          <div>
            <Button
              type="button"
              disabled={!hasChanges || isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving..." : "Save sibling discount"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
