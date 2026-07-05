import { useConvexQuery } from "@convex-dev/react-query";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type MonthState = {
  year: number;
  month: number;
};

export function StudentBirthdaysWidget() {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState<MonthState>(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }));
  const birthdays = useConvexQuery(api.classes.listStudentBirthdays, {
    year: visibleMonth.year,
    month: visibleMonth.month,
  });

  const monthLabel = formatMonthLabel(visibleMonth, today.getFullYear());

  function shiftMonth(delta: number) {
    setVisibleMonth((current) => {
      const date = new Date(current.year, current.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  }

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight">Birthdays</h2>
      <Card className="gap-0 overflow-hidden rounded-3xl py-0">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-3 py-3 sm:px-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <div className="text-lg font-semibold" aria-live="polite">
              {monthLabel}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 px-4 text-base">Name</TableHead>
                <TableHead className="h-12 px-4 text-base">Date</TableHead>
                <TableHead className="h-12 px-4 text-right text-base">
                  Age
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {birthdays === undefined ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-28 px-4 text-center text-muted-foreground"
                  >
                    Checking birthdays…
                  </TableCell>
                </TableRow>
              ) : birthdays.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-28 px-4 text-center text-muted-foreground"
                  >
                    No student birthdays this month.
                  </TableCell>
                </TableRow>
              ) : (
                birthdays.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-9 shrink-0">
                          <AvatarImage
                            src={student.photoUrl || undefined}
                            alt={student.name}
                          />
                          <AvatarFallback>
                            {student.firstName?.[0]}
                            {student.lastName?.[0]}
                            {!student.firstName && !student.lastName ? (
                              <UserRound className="size-4" />
                            ) : null}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">
                          {student.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatBirthdayDate(student.birthdayDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatBirthdayAge({
                        birthYear: student.birthYear,
                        birthdayDate: student.birthdayDate,
                        today,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function formatMonthLabel(month: MonthState, currentYear: number) {
  const date = new Date(month.year, month.month - 1, 1);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: month.year === currentYear ? undefined : "numeric",
  }).format(date);
}

function formatBirthdayDate(value: string) {
  const date = parseDateValue(value);
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatBirthdayAge({
  birthYear,
  birthdayDate,
  today,
}: {
  birthYear: number;
  birthdayDate: string;
  today: Date;
}) {
  const birthday = parseDateValue(birthdayDate);
  if (!birthday || !Number.isFinite(birthYear)) {
    return "—";
  }

  const turningAge = birthday.getFullYear() - birthYear;
  const ageBeforeBirthday = Math.max(turningAge - 1, 0);
  if (birthday.getTime() > startOfDay(today).getTime()) {
    return `${ageBeforeBirthday} → ${turningAge}`;
  }

  return String(turningAge);
}

function parseDateValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
