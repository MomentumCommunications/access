import { Plus, Save, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  applyTuitionTierPaste,
  formatCurrencyFromCents,
  formatWeeklyHours,
  parseTabularText,
  type NormalizedTuitionTier,
  type TuitionTierDraftRow,
  type TuitionTierField,
  validateTuitionTierDraftRows,
} from "../../shared/tuition-pricing";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type GridRow = TuitionTierDraftRow & { id: string };

type TuitionTierGridProps = {
  tiers: NormalizedTuitionTier[];
  readOnly?: boolean;
  isSaving?: boolean;
  onSave?: (tiers: NormalizedTuitionTier[]) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

const fields: TuitionTierField[] = [
  "label",
  "maxWeeklyHours",
  "monthlyAmount",
];

function initialGridRows(tiers: NormalizedTuitionTier[]): GridRow[] {
  if (tiers.length === 0) {
    return [
      {
        id: "row-0",
        label: "",
        maxWeeklyHours: "",
        monthlyAmount: "",
      },
    ];
  }
  return tiers.map((tier, index) => ({
    id: `row-${index}`,
    label: tier.label,
    maxWeeklyHours: formatWeeklyHours(tier.maxWeeklyMinutes),
    monthlyAmount: formatCurrencyFromCents(tier.monthlyAmountCents),
  }));
}

export function TuitionTierGrid({
  tiers,
  readOnly = false,
  isSaving = false,
  onSave,
  onDirtyChange,
}: TuitionTierGridProps) {
  const initialRows = useMemo(() => initialGridRows(tiers), [tiers]);
  const [rows, setRows] = useState(initialRows);
  const [showErrors, setShowErrors] = useState(false);
  const nextRowId = useRef(rows.length);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const validation = useMemo(
    () => validateTuitionTierDraftRows(rows),
    [rows],
  );
  const initialFingerprint = useMemo(
    () =>
      JSON.stringify(
        initialRows.map(({ label, maxWeeklyHours, monthlyAmount }) => ({
          label,
          maxWeeklyHours,
          monthlyAmount,
        })),
      ),
    [initialRows],
  );
  const currentFingerprint = JSON.stringify(
    rows.map(({ label, maxWeeklyHours, monthlyAmount }) => ({
      label,
      maxWeeklyHours,
      monthlyAmount,
    })),
  );

  useEffect(() => {
    onDirtyChange?.(currentFingerprint !== initialFingerprint);
  }, [currentFingerprint, initialFingerprint, onDirtyChange]);

  function createRow(): GridRow {
    return {
      id: `row-${nextRowId.current++}`,
      label: "",
      maxWeeklyHours: "",
      monthlyAmount: "",
    };
  }

  function focusCell(rowId: string, field: TuitionTierField) {
    requestAnimationFrame(() => {
      inputRefs.current.get(`${rowId}:${field}`)?.focus();
    });
  }

  function updateCell(
    rowIndex: number,
    field: TuitionTierField,
    value: string,
  ) {
    setRows((current) =>
      current.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addRow(focus = true) {
    const row = createRow();
    setRows((current) => [...current, row]);
    if (focus) focusCell(row.id, "label");
  }

  function insertRow(afterIndex: number) {
    const row = createRow();
    setRows((current) => [
      ...current.slice(0, afterIndex + 1),
      row,
      ...current.slice(afterIndex + 1),
    ]);
    focusCell(row.id, "label");
  }

  function removeRow(rowIndex: number) {
    setRows((current) => {
      const next = current.filter((_, index) => index !== rowIndex);
      return next.length > 0 ? next : [createRow()];
    });
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    if (event.key === "Tab") {
      const currentCell = rowIndex * fields.length + columnIndex;
      const targetCell = currentCell + (event.shiftKey ? -1 : 1);
      if (targetCell < 0) return;
      event.preventDefault();

      if (targetCell >= rows.length * fields.length) {
        const row = createRow();
        setRows((current) => [...current, row]);
        focusCell(row.id, "label");
        return;
      }

      const targetRow = Math.floor(targetCell / fields.length);
      const targetColumn = targetCell % fields.length;
      focusCell(rows[targetRow].id, fields[targetColumn]);
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) {
      insertRow(rowIndex);
      return;
    }

    if (rowIndex + 1 < rows.length) {
      focusCell(rows[rowIndex + 1].id, fields[columnIndex]);
    } else {
      const row = createRow();
      setRows((current) => [...current, row]);
      focusCell(row.id, fields[columnIndex]);
    }
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    const pasted = parseTabularText(event.clipboardData.getData("text"));
    if (pasted.length === 0) return;
    event.preventDefault();

    setRows((current) => {
      const pastedRows = applyTuitionTierPaste(
        current,
        rowIndex,
        columnIndex,
        pasted,
      );
      return pastedRows.map((row, index) => ({
        ...row,
        id: current[index]?.id || createRow().id,
      }));
    });
  }

  async function save() {
    setShowErrors(true);
    if (Object.keys(validation.errors).length > 0 || !onSave) return;
    await onSave(validation.tiers);
    setShowErrors(false);
  }

  if (readOnly) {
    return (
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Up to weekly hours</TableHead>
              <TableHead>Monthly tuition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TableRow key={tier.sortOrder}>
                <TableCell className="font-medium">{tier.label}</TableCell>
                <TableCell>
                  {tier.maxWeeklyMinutes === undefined
                    ? "Unlimited"
                    : formatWeeklyHours(tier.maxWeeklyMinutes)}
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(tier.monthlyAmountCents / 100)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[42rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Tier</TableHead>
              <TableHead className="w-[25%]">Up to weekly hours</TableHead>
              <TableHead className="w-[25%]">Monthly tuition</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={row.id} className="hover:bg-transparent">
                {fields.map((field, columnIndex) => {
                  const error = showErrors
                    ? validation.errors[rowIndex]?.[field]
                    : undefined;
                  const errorId = `${row.id}-${field}-error`;
                  return (
                    <TableCell key={field} className="align-top">
                      <Input
                        ref={(element) => {
                          const key = `${row.id}:${field}`;
                          if (element) inputRefs.current.set(key, element);
                          else inputRefs.current.delete(key);
                        }}
                        value={row[field]}
                        aria-label={
                          field === "label"
                            ? `Tier name row ${rowIndex + 1}`
                            : field === "maxWeeklyHours"
                              ? `Maximum weekly hours row ${rowIndex + 1}`
                              : `Monthly tuition row ${rowIndex + 1}`
                        }
                        aria-invalid={!!error}
                        aria-describedby={error ? errorId : undefined}
                        inputMode={
                          field === "label" ? undefined : "decimal"
                        }
                        placeholder={
                          field === "label"
                            ? "Tier name"
                            : field === "maxWeeklyHours"
                              ? "Blank = unlimited"
                              : "0.00"
                        }
                        onChange={(event) =>
                          updateCell(rowIndex, field, event.target.value)
                        }
                        onKeyDown={(event) =>
                          handleKeyDown(event, rowIndex, columnIndex)
                        }
                        onPaste={(event) =>
                          handlePaste(event, rowIndex, columnIndex)
                        }
                      />
                      {error ? (
                        <p
                          id={errorId}
                          className="mt-1 max-w-56 text-xs text-destructive"
                        >
                          {error}
                        </p>
                      ) : null}
                    </TableCell>
                  );
                })}
                <TableCell className="align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove row ${rowIndex + 1}`}
                    onClick={() => removeRow(rowIndex)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => addRow()}>
          <Plus />
          Add row
        </Button>
        <Button type="button" onClick={save} disabled={isSaving}>
          <Save />
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
