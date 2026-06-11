import * as React from "react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { Textarea } from "./ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { ScrollArea } from "./ui/scroll-area";
import { Id } from "convex/_generated/dataModel";
import { useIsMobile } from "~/hooks/use-mobile";
import { useNavigate } from "@tanstack/react-router";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";
import type { DateRange } from "react-day-picker";

export function AddBulletin() {
  const [open, setOpen] = React.useState(false);

  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (isMobile) {
    return (
      <Button
        variant="outline"
        onClick={() => navigate({ to: "/create-bulletin" })}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Bulletin</DialogTitle>
          <DialogDescription>
            What would you like everyone to know?
          </DialogDescription>
        </DialogHeader>
        <BulletinForm />
      </DialogContent>
    </Dialog>
  );
}

const formSchema = z.object({
  post: z.string().min(2).max(50),
  body: z.string().min(2).max(2000),
  groups: z.array(z.string()), // Group IDs now
  date: z.string(),
  endDate: z.string().optional(),
});

const DATE_FORMAT = "yyyy-MM-dd";
const DISPLAY_DATE_FORMAT = "LLL d, yyyy";
const DEFAULT_TIME = "03:00";

function formatDateValue(date: Date) {
  return format(date, DATE_FORMAT);
}

function formatDateTimeValue(date: Date, time: string) {
  return `${formatDateValue(date)}T${time}`;
}

function parseDateInput(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: Date | undefined;
  time: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
      <div className="flex gap-2">
        <Input
          type="date"
          value={date ? formatDateValue(date) : ""}
          onChange={(event) => onDateChange(parseDateInput(event.target.value))}
          aria-label="Bulletin date"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open date picker"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
            align="start"
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={onDateChange}
              className="w-full"
            />
          </PopoverContent>
        </Popover>
      </div>
      <Input
        type="time"
        value={time}
        onChange={(event) => onTimeChange(event.target.value)}
        aria-label="Bulletin time"
        className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  );
}

function DateRangePicker({
  dateRange,
  onDateRangeChange,
}: {
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
}) {
  const label =
    dateRange?.from && dateRange.to
      ? `${format(dateRange.from, DISPLAY_DATE_FORMAT)} - ${format(
          dateRange.to,
          DISPLAY_DATE_FORMAT,
        )}`
      : dateRange?.from
        ? format(dateRange.from, DISPLAY_DATE_FORMAT)
        : "Pick a date range";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!dateRange?.from}
          className="data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="h-4 w-4" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={onDateRangeChange}
          numberOfMonths={2}
          className="w-full"
        />
      </PopoverContent>
    </Popover>
  );
}

function BulletinForm({ className }: React.ComponentProps<"form">) {
  const [isRangeMode, setIsRangeMode] = React.useState(false);
  const [singleDate, setSingleDate] = React.useState<Date | undefined>();
  const [time, setTime] = React.useState(DEFAULT_TIME);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const groups = useQuery(api.etcFunctions.getGroups, {});
  // Get mutation function from Convex
  const mutationFn = useConvexMutation(api.bulletins.createBulletin);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const attachImage = useMutation(api.bulletins.attachImage);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      post: "",
      body: "",
      groups: [],
      date: "",
      endDate: undefined,
    },
  });

  function setSingleDateTimeValue(nextDate: Date | undefined, nextTime = time) {
    setSingleDate(nextDate);
    form.setValue(
      "date",
      nextDate ? formatDateTimeValue(nextDate, nextTime) : "",
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue("endDate", undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function setDateRangeValue(nextRange: DateRange | undefined) {
    setDateRange(nextRange);
    form.setValue(
      "date",
      nextRange?.from ? formatDateValue(nextRange.from) : "",
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
    form.setValue(
      "endDate",
      nextRange?.to ? formatDateValue(nextRange.to) : undefined,
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleDateModeChange(checked: boolean) {
    setIsRangeMode(checked);

    if (checked) {
      const nextRange = singleDate
        ? { from: singleDate, to: singleDate }
        : undefined;
      setDateRangeValue(nextRange);
      return;
    }

    const nextDate = dateRange?.from;
    setSingleDateTimeValue(nextDate, time);
  }

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const title = values.post;
    const body = values.body;
    // const team = values.groups; // This now contains group IDs
    const date = values.date;
    const endDate = values.endDate;

    // Convert group IDs to group names for backward compatibility
    const groupNames =
      groups?.filter((g) => values.groups.includes(g._id)).map((g) => g.name) ||
      [];

    const newBulletinId = await mutationFn({
      title,
      body,
      team: groupNames, // Keep old format for now
      date,
      ...(endDate ? { endDate } : {}),
      groups: values.groups as Id<"groups">[], // Pass group IDs to new field
    });

    {
      if (selectedImage) {
        const postUrl = await generateUploadUrl();
        // Step 1: POST the file to the URL
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": selectedImage!.type },
          body: selectedImage,
        });
        const { storageId } = await result.json();
        // Step 2: Save the newly allocated storage id to the database
        await attachImage({
          storageId,
          bulletin: newBulletinId,
        });

        setSelectedImage(null);
        imageInput.current!.value = "";
      }
    }
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        keyCode: 27,
        code: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  return (
    <ScrollArea>
      <Form {...form}>
        <form
          className={cn("grid items-start gap-6", className)}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="post"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-4">
                  <FormLabel>Date</FormLabel>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      Single
                    </span>
                    <Switch
                      checked={isRangeMode}
                      onCheckedChange={handleDateModeChange}
                      aria-label="Use date range"
                    />
                    <span className="text-muted-foreground text-sm">Range</span>
                  </div>
                </div>
                <input type="hidden" {...field} />
                {isRangeMode ? (
                  <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={setDateRangeValue}
                  />
                ) : (
                  <DateTimePicker
                    date={singleDate}
                    time={time}
                    onDateChange={(nextDate) =>
                      setSingleDateTimeValue(nextDate)
                    }
                    onTimeChange={(nextTime) => {
                      setTime(nextTime);
                      setSingleDateTimeValue(singleDate, nextTime);
                    }}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => <input type="hidden" {...field} />}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body</FormLabel>
                <FormControl>
                  <Textarea className="min-h-50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="groups"
            render={() => (
              <FormItem>
                <FormLabel>Group</FormLabel>
                {groups?.map((group) => (
                  <FormField
                    key={group._id}
                    control={form.control}
                    name="groups"
                    render={({ field }) => (
                      <FormItem
                        key={group._id}
                        className="flex flex-row items-center gap-2"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(group._id)}
                            onCheckedChange={(checked) => {
                              // Ensure field.value is always an array
                              const currentValue = field.value || [];
                              return checked
                                ? field.onChange([...currentValue, group._id])
                                : field.onChange(
                                    currentValue.filter(
                                      (value) => value !== group._id,
                                    ),
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          {group.name}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </FormItem>
            )}
          />
          <input
            type="file"
            accept="image/*"
            ref={imageInput}
            onChange={(event) => setSelectedImage(event.target.files![0])}
            disabled={selectedImage !== null}
          />
          <Button type="submit">Save changes</Button>
        </form>
      </Form>
    </ScrollArea>
  );
}
