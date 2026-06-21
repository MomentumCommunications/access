import { useConvexMutation } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import type { DateRange } from "react-day-picker";
import React from "react";

export const Route = createFileRoute("/_app/admin/bulletins/create")({
  component: RouteComponent,
});

const formSchema = z.object({
  post: z.string().min(2).max(50),
  body: z.string().min(2).max(2000),
  groups: z.array(z.string()), // Group IDs now
  date: z.string(),
  endDate: z.string().optional(),
});

const DATE_FORMAT = "yyyy-MM-dd";
const DISPLAY_DATE_FORMAT = "LLL d, yyyy";
const DEFAULT_TIME = "09:00";

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
          numberOfMonths={1}
          className="w-full"
        />
      </PopoverContent>
    </Popover>
  );
}

function RouteComponent() {
  const [isRangeMode, setIsRangeMode] = React.useState(false);
  const [singleDate, setSingleDate] = React.useState<Date | undefined>();
  const [time, setTime] = React.useState(DEFAULT_TIME);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const navigate = useNavigate();
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
      groups: values.groups as Id<"groups">[], // Pass group IDs to new field
      ...(endDate ? { endDate } : {}),
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

    await navigate({ to: "/admin/bulletins" });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-2 px-2 pb-12">
      <div className="flex w-full items-center justify-end">
        <Button
          variant="link"
          onClick={() => navigate({ to: "/admin/bulletins" })}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
      </div>
      <div className="w-full">
        <h1 className="text-foreground mb-4 text-3xl font-bold">
          Create Bulletin
        </h1>
        <Separator className="bg-muted mb-2" />
      </div>
      <Form {...form}>
        <form
          className="grid w-full items-start gap-6"
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
                  <Textarea {...field} className="min-h-52" />
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
                <FormLabel>Group(s)</FormLabel>
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
    </div>
  );
}
