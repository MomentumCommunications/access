import { Separator } from "./ui/separator";
import { cn } from "~/lib/utils";

interface DateSeparatorProps {
  dateLabel: string;
  className?: string;
}

export function DateSeparator({ dateLabel, className }: DateSeparatorProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center py-4 my-2",
        className,
      )}
    >
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative bg-background px-4 text-sm text-muted-foreground font-medium">
        {dateLabel}
      </div>
    </div>
  );
}