import {
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { DateRange } from "react-day-picker";
import z from "zod";
import { hasUserRole } from "~/lib/roles";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
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
import { parseBulletinDate } from "~/lib/bulletin-date";

type Bulletin = {
  _id: Id<"bulletin">;
  title: string;
  body: string;
  pinned: boolean;
  image?: string;
  date?: string;
  endDate?: string;
  author?: string;
  audience?: "all";
  group?: string[];
  groups?: Id<"groups">[];
  hidden?: boolean;
};

export const Route = createFileRoute(
  "/_app/admin/bulletins/$bulletinId_/edit",
)({
  component: RouteComponent,
});

const formSchema = z.object({
  title: z.string().min(2).max(50),
  body: z.string().min(2).max(2000),
  audienceAll: z.boolean(),
  groups: z.array(z.string()),
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

function getInitialTime(date?: string) {
  const parsedDate = parseBulletinDate(date);
  return date?.includes("T") && parsedDate
    ? format(parsedDate, "HH:mm")
    : DEFAULT_TIME;
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
            align="center"
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
  const { bulletinId } = Route.useParams();
  const bulletin = useConvexQuery(api.bulletins.getBulletin, {
    id: bulletinId,
  });
  const currentUser = useConvexQuery(api.users.current, {});
  const navigate = useNavigate();

  if (bulletin === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col px-2 pb-2">
        <p>Loading...</p>
      </div>
    );
  }

  if (bulletin === null) throw notFound();

  if (currentUser === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col px-2 pb-2">
        <p>Loading...</p>
      </div>
    );
  }

  if (!hasUserRole(currentUser, "admin")) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-2 pb-2">
        <div className="flex w-full items-center justify-end">
          <Button
            variant="link"
            onClick={() => navigate({ to: "/admin/bulletins" })}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
        <p>You do not have permission to edit this bulletin.</p>
      </div>
    );
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
          Edit Bulletin
        </h1>
        <Separator className="bg-muted mb-2" />
      </div>
      <EditBulletinForm bulletin={bulletin} />
    </div>
  );
}

function EditBulletinForm({ bulletin }: { bulletin: Bulletin }) {
  const initialDate = parseBulletinDate(bulletin.date);
  const initialEndDate = parseBulletinDate(bulletin.endDate);
  const [isRangeMode, setIsRangeMode] = useState(!!initialEndDate);
  const [singleDate, setSingleDate] = useState<Date | undefined>(
    initialDate ?? undefined,
  );
  const [time, setTime] = useState(getInitialTime(bulletin.date));
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialEndDate
      ? { from: initialDate ?? initialEndDate, to: initialEndDate }
      : undefined,
  );
  const groups = useConvexQuery(api.etcFunctions.getGroups, {});
  const mutationFn = useConvexMutation(api.bulletins.editBulletin);

  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: bulletin.title,
      body: bulletin.body,
      audienceAll: bulletin.audience === "all",
      groups: [],
      date: bulletin.date ?? "",
      endDate: bulletin.endDate,
    },
  });

  function setSingleDateTimeValue(nextDate: Date | undefined, nextTime = time) {
    setSingleDate(nextDate);
    form.setValue(
      "date",
      nextDate ? formatDateTimeValue(nextDate, nextTime) : "",
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue("endDate", "", {
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

  useEffect(() => {
    if (groups && bulletin) {
      const groupIds =
        bulletin.groups && bulletin.groups.length > 0
          ? bulletin.groups
          : groups
              .filter((g) => bulletin.group?.includes(g.name))
              .map((g) => g._id);

      form.reset({
        title: bulletin.title,
        body: bulletin.body,
        audienceAll: bulletin.audience === "all",
        groups: groupIds,
        date: bulletin.date ?? "",
        endDate: bulletin.endDate,
      });
    }
  }, [groups, bulletin, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const title = values.title;
    const body = values.body;
    const groupIds = values.groups as Id<"groups">[];
    const date = values.date;
    const endDate = values.endDate;

    const groupNames =
      groups?.filter((g) => groupIds.includes(g._id)).map((g) => g.name) || [];

    await mutationFn({
      id: bulletin._id,
      title,
      body,
      group: groupNames,
      groups: groupIds,
      audience: values.audienceAll ? "all" : undefined,
      date,
      endDate,
    });

    await navigate({ to: "/admin/bulletins" });
  }

  return (
    <Form {...form}>
      <form
        className="grid w-full items-start gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="What's on your mind?" {...field} />
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
                  <span className="text-muted-foreground text-sm">Single</span>
                  <Switch
                    checked={isRangeMode}
                    onCheckedChange={handleDateModeChange}
                    aria-label="Use date range"
                  />
                  <span className="text-muted-foreground text-sm">Range</span>
                </div>
              </div>
              <FormDescription>
                Date is set to {bulletin.date || "not set"}
              </FormDescription>
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
                  onDateChange={(nextDate) => setSingleDateTimeValue(nextDate)}
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
                <Textarea
                  {...field}
                  placeholder="What's on your mind?"
                  className="min-h-32"
                />
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
              <FormLabel>Audience</FormLabel>
              <FormField
                control={form.control}
                name="audienceAll"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-2 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked === true);
                          if (checked) form.setValue("groups", []);
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal">
                        Show this event to everyone
                      </FormLabel>
                      <p className="text-muted-foreground text-xs">
                        Ignore group filtering for this calendar event.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
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
                          disabled={form.watch("audienceAll")}
                          checked={field.value?.includes(group._id)}
                          onCheckedChange={(checked) => {
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
        <Button type="submit">Save changes</Button>
      </form>
    </Form>
  );
}
