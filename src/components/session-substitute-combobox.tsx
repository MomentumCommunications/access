import type { Doc, Id } from "convex/_generated/dataModel";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { getAccountName } from "~/lib/account-name";
import { hasUserRole } from "~/lib/roles";

type StaffOption = {
  value: string;
  label: string;
};

function buildStaffOptions(accounts: Doc<"users">[] | undefined): StaffOption[] {
  return [
    { value: "none", label: "No substitute" },
    ...(accounts || [])
      .filter(
        (account) =>
          hasUserRole(account, "staff") || hasUserRole(account, "admin"),
      )
      .map((account) => ({
        value: account._id,
        label: getAccountName(account),
      })),
  ];
}

export function SessionSubstituteCombobox({
  accounts,
  value,
  onValueChange,
  disabled,
  placeholder = "Select substitute",
  className,
}: {
  accounts: Doc<"users">[] | undefined;
  value: Id<"users"> | undefined;
  onValueChange: (value: Id<"users"> | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const staffOptions = buildStaffOptions(accounts);
  const selectedValue = value || "none";

  return (
    <Combobox
      items={staffOptions.map((option) => option.value)}
      value={selectedValue}
      onValueChange={(nextValue) =>
        onValueChange(
          nextValue && nextValue !== "none"
            ? (nextValue as Id<"users">)
            : null,
        )
      }
      itemToStringLabel={(optionValue) =>
        staffOptions.find((option) => option.value === optionValue)?.label || ""
      }
      disabled={disabled}
    >
      <ComboboxInput
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>No staff found.</ComboboxEmpty>
        <ComboboxList>
          {(optionValue: string) => (
            <ComboboxItem key={optionValue} value={optionValue}>
              {staffOptions.find((option) => option.value === optionValue)
                ?.label || optionValue}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

