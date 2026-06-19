import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/utils";

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function selectedRange(start: string, end: string): DateRange {
  return {
    from: parseDateValue(start),
    to: parseDateValue(end),
  };
}

export function BillingDateRangePicker({
  id,
  start,
  end,
  onChange,
  label = "Billing period",
  className,
}: {
  id: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  label?: string;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const [range, setRange] = useState<DateRange>(() =>
    selectedRange(start, end),
  );

  useEffect(() => {
    setRange(selectedRange(start, end));
  }, [start, end]);

  const rangeLabel =
    range.from && range.to
      ? `${format(range.from, "MMM d, yyyy")} – ${format(
          range.to,
          "MMM d, yyyy",
        )}`
      : range.from
        ? `${format(range.from, "MMM d, yyyy")} – Select an end date`
        : "Select a date range";

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className="w-full justify-start text-left font-normal sm:w-72"
          >
            <CalendarRange />
            <span className="truncate">{rangeLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[calc(100vw-2rem)] overflow-x-auto p-0 md:w-lg"
        >
          <Calendar
            mode="range"
            selected={range}
            defaultMonth={range.from}
            onSelect={(nextRange) => {
              setRange(nextRange);
              if (nextRange?.from && nextRange.to) {
                onChange(dateValue(nextRange.from), dateValue(nextRange.to));
              }
            }}
            numberOfMonths={isMobile ? 1 : 2}
            className="w-full mx-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
