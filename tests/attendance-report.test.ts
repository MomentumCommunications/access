import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  attendanceRangeError,
  attendanceReportTotals,
  attendanceReportView,
  attendanceSeasonRange,
  buildAttendanceReport,
  defaultAttendanceRange,
  formatAttendanceRate,
  parseAttendanceReportSearch,
  topAbsenceReason,
  type AttendanceSessionInput,
} from "../shared/attendance-report.ts";

const students = [
  {
    _id: "amy",
    firstName: "Amy",
    lastName: "Adams",
    preferredName: "Ace",
    groupId: "g1",
    status: "active",
  },
  { _id: "ben", firstName: "Ben", lastName: "Brown", status: "active" },
  { _id: "zero", firstName: "Zero", lastName: "Records", status: "active" },
  { _id: "old", firstName: "Old", lastName: "Student", status: "inactive" },
];
const range = { start: "2026-07-10", end: "2026-11-10" };
function session(
  overrides: Partial<AttendanceSessionInput> = {},
): AttendanceSessionInput {
  return {
    date: range.start,
    active: true,
    status: "completed",
    records: [],
    addedStudentIds: [],
    ...overrides,
  };
}
const sessions = [
  session({
    records: [
      { student: "amy", status: "present" },
      { student: "ben", status: "absent", reason: "sick" },
      { student: "old", status: "present" },
    ],
  }),
  session({
    date: range.end,
    records: [
      { student: "amy", status: "late" },
      { student: "ben", status: "present" },
    ],
    addedStudentIds: ["amy", "amy"],
  }),
  session({
    records: [
      { student: "amy", status: "absent", reason: "vacation" },
      { student: "ben", status: "excused" },
    ],
    addedStudentIds: ["amy"],
  }),
  session({ records: [{ student: "amy", status: "absent" }] }),
  session({
    records: [{ student: "amy", status: "excused" }],
    addedStudentIds: ["amy"],
  }),
];
const groups = [{ _id: "g1", name: "Team" }];

describe("attendance report calculations", () => {
  it("counts late as present and attended manual additions exactly once", () => {
    const rows = buildAttendanceReport(students, sessions, range);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], {
      studentId: "amy",
      name: "Amy Adams",
      preferredName: "Ace",
      groupId: "g1",
      present: 2,
      absent: 2,
      makeups: 1,
      reasons: { vacation: 1 },
    });
    assert.equal(rows[1].present, 1);
    assert.equal(rows[1].absent, 1);
    assert.equal(rows[2].present + rows[2].absent, 0);
  });
  it("includes both date boundaries and excludes inactive, cancelled, and out-of-range sessions", () => {
    const mark = [{ student: "amy", status: "present" }];
    const rows = buildAttendanceReport(
      students,
      [
        session({ date: range.start, records: mark }),
        session({ date: range.end, records: mark }),
        session({ date: "2026-07-09", records: mark }),
        session({ date: "2026-11-11", records: mark }),
        session({ active: false, records: mark }),
        session({ status: "cancelled", records: mark }),
      ],
      range,
    );
    assert.equal(rows[0].present, 2);
  });
  it("reports only supplied reasons, preserving alphabetical ties", () => {
    assert.equal(
      topAbsenceReason({ sick: 3, vacation: 3, homework: 1 }),
      "Sick, Vacation",
    );
    assert.equal(topAbsenceReason({}), "");
    assert.equal(formatAttendanceRate(null), "-");
  });
  it("filters current groups, no group, names, and preferred names", () => {
    const rows = buildAttendanceReport(students, sessions, range);
    assert.deepEqual(
      attendanceReportView(rows, groups, { group: "g1" }).map(
        (row) => row.studentId,
      ),
      ["amy"],
    );
    assert.deepEqual(
      attendanceReportView(rows, groups, { group: "none" }).map(
        (row) => row.studentId,
      ),
      ["ben", "zero"],
    );
    assert.equal(
      attendanceReportView(rows, groups, { q: "  ACE " })[0].studentId,
      "amy",
    );
    assert.equal(
      attendanceReportView(rows, groups, { q: "brown", group: "g1" }).length,
      0,
    );
  });
  it("sorts numerically using unrounded rates, stable names, and empty rates last", () => {
    const rows = buildAttendanceReport(students, sessions, range);
    rows[0].present = 9;
    rows[0].absent = 2;
    rows[1].present = 100;
    rows[1].absent = 1;
    assert.deepEqual(
      attendanceReportView(rows, groups, {}).map((row) => row.studentId),
      ["ben", "amy", "zero"],
    );
    assert.deepEqual(
      attendanceReportView(rows, groups, { order: "asc" }).map(
        (row) => row.studentId,
      ),
      ["amy", "ben", "zero"],
    );
    assert.deepEqual(
      attendanceReportView(rows, groups, { sort: "present" }).map(
        (row) => row.studentId,
      ),
      ["ben", "amy", "zero"],
    );
    rows[1].present = 9;
    rows[1].absent = 2;
    assert.deepEqual(
      attendanceReportView(rows, groups, {}).map((row) => row.studentId),
      ["amy", "ben", "zero"],
    );
    rows[0].present = 9999;
    rows[0].absent = 1;
    rows[1].present = 9998;
    rows[1].absent = 1;
    assert.equal(attendanceReportView(rows, groups, {})[0].studentId, "amy");
  });
  it("weights totals by records across every matching row, not table pages or student averages", () => {
    const rows = buildAttendanceReport(students, sessions, range);
    rows[0].present = 9;
    rows[0].absent = 1;
    rows[1].present = 0;
    rows[1].absent = 1;
    const totals = attendanceReportTotals(
      attendanceReportView(rows, groups, {}),
    );
    assert.equal(totals.rate, (9 / 11) * 100);
    assert.equal(totals.students, 3);
    assert.equal(formatAttendanceRate(totals.rate), "81.8%");
    const many = Array.from({ length: 100 }, (_, i) => ({
      ...rows[0],
      studentId: `${i}`,
      present: 1,
      absent: 1,
    }));
    assert.deepEqual(attendanceReportTotals(many), {
      present: 100,
      absent: 100,
      rate: 50,
      students: 100,
    });
    assert.equal(attendanceReportTotals([]).rate, null);
  });
});

describe("attendance dates and URL state", () => {
  it("uses Eastern today and clamps four calendar months at month end", () => {
    assert.deepEqual(
      defaultAttendanceRange(new Date("2026-11-11T02:00:00Z")),
      range,
    );
    assert.deepEqual(defaultAttendanceRange(new Date("2026-06-30T12:00:00Z")), {
      start: "2026-02-28",
      end: "2026-06-30",
    });
    assert.deepEqual(defaultAttendanceRange(new Date("2024-06-30T12:00:00Z")), {
      start: "2024-02-29",
      end: "2024-06-30",
    });
  });
  it("validates dates and uses season dates without class filtering", () => {
    for (const [start, end] of [
      ["2026-02-30", "2026-03-01"],
      ["", range.end],
      [range.end, range.start],
    ]) {
      assert.ok(attendanceRangeError(start, end));
      assert.throws(() => buildAttendanceReport(students, [], { start, end }));
    }
    assert.equal(attendanceRangeError(range.start, range.end), null);
    assert.deepEqual(
      attendanceSeasonRange({
        _id: "s",
        startDate: range.start,
        endDate: range.end,
      }),
      { ...range, season: "s" },
    );
  });
  it("preserves filters and allowed sorting and drops unsupported URL values", () => {
    const search = {
      ...range,
      group: "none",
      q: "Amy",
      season: "past",
      sort: "absent",
      order: "asc",
    };
    assert.deepEqual(parseAttendanceReportSearch(search), search);
    assert.deepEqual(
      parseAttendanceReportSearch({ sort: "bad", order: "bad", q: 4 }),
      {},
    );
  });
});

// Exercise the real report handlers and authorization; stub the signed-in user boundary.
const userStub =
  "data:text/javascript," +
  encodeURIComponent(
    "export async function getCurrentUserOrThrow(ctx) { if (!ctx.actor) throw new Error(\"Unauthenticated\"); return ctx.actor; }",
  );
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "./users" &&
      context.parentURL?.endsWith("/convex/reports.ts")
    )
      return nextResolve(userStub, context);
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && context.parentURL) {
        for (const extension of [".ts", ".js"]) {
          const url = new URL(specifier + extension, context.parentURL);
          if (existsSync(fileURLToPath(url)))
            return nextResolve(url.href, context);
        }
      }
      throw error;
    }
  },
});
const { adminAttendanceReport, adminAttendanceReportOptions } = await import(
  "../convex/reports.ts"
);
type StoredRow = Record<string, unknown>;
function fixture(role: string | null = "admin") {
  const stored: Record<string, StoredRow[]> = {
    students,
    sessions: [
      { _id: "start", date: range.start, active: true, status: "completed" },
      { _id: "end", date: range.end, active: true, status: "scheduled" },
      {
        _id: "cancelled",
        date: range.start,
        active: true,
        status: "cancelled",
      },
      {
        _id: "inactive",
        date: range.start,
        active: false,
        status: "completed",
      },
      { _id: "outside", date: "2020-01-01", active: true, status: "completed" },
    ],
    attendanceRecords: [
      { session: "start", student: "amy", status: "late" },
      { session: "end", student: "amy", status: "present" },
      { session: "end", student: "ben", status: "absent", reason: "sick" },
    ],
    sessionStudents: [{ session: "start", student: "amy" }],
    groups,
    seasons: [
      {
        _id: "past",
        name: "Past season",
        startDate: "2025-01-01",
        endDate: "2025-06-01",
      },
    ],
  };
  const reads: { table: string; index?: string; constraints: unknown[][] }[] =
    [];
  const ctx = {
    actor: role ? { roles: [role] } : null,
    db: {
      query(table: string) {
        const read = {
          table,
          index: undefined as string | undefined,
          constraints: [] as unknown[][],
        };
        reads.push(read);
        const predicates: ((row: StoredRow) => boolean)[] = [];
        const builder = {
          eq(key: string, value: string) {
            read.constraints.push(["eq", key, value]);
            predicates.push((row) => row[key] === value);
            return builder;
          },
          gte(key: string, value: string) {
            read.constraints.push(["gte", key, value]);
            predicates.push((row) => String(row[key]) >= value);
            return builder;
          },
          lte(key: string, value: string) {
            read.constraints.push(["lte", key, value]);
            predicates.push((row) => String(row[key]) <= value);
            return builder;
          },
        };
        const query = {
          withIndex(index: string, cb: (q: typeof builder) => unknown) {
            read.index = index;
            cb(builder);
            return query;
          },
          async collect() {
            return (stored[table] ?? []).filter((row) =>
              predicates.every((fn) => fn(row)),
            );
          },
        };
        return query;
      },
    },
  };
  return { ctx, reads };
}
async function run<T>(fn: unknown, ctx: unknown, args: unknown): Promise<T> {
  return (
    fn as { _handler: (ctx: unknown, args: unknown) => Promise<T> }
  )._handler(ctx, args);
}

describe("attendance report backend", () => {
  it("rejects signed-out, member, and staff callers before reading records", async () => {
    for (const role of [null, "member", "staff"]) {
      const { ctx, reads } = fixture(role);
      await assert.rejects(run(adminAttendanceReport, ctx, range));
      await assert.rejects(run(adminAttendanceReportOptions, ctx, {}));
      assert.deepEqual(reads, []);
    }
  });
  it("validates range before database access", async () => {
    const { ctx, reads } = fixture();
    await assert.rejects(
      run(adminAttendanceReport, ctx, { start: range.end, end: range.start }),
    );
    assert.deepEqual(reads, []);
  });
  it("reads the date range and active students with indexes; loads only eligible session records", async () => {
    const { ctx, reads } = fixture();
    const rows = await run<ReturnType<typeof buildAttendanceReport>>(
      adminAttendanceReport,
      ctx,
      range,
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[0].present, 2);
    assert.equal(rows[0].makeups, 1);
    assert.deepEqual(
      reads.find((read) => read.table === "students"),
      {
        table: "students",
        index: "byStatus",
        constraints: [["eq", "status", "active"]],
      },
    );
    assert.deepEqual(
      reads.find((read) => read.table === "sessions"),
      {
        table: "sessions",
        index: "byDate",
        constraints: [
          ["gte", "date", range.start],
          ["lte", "date", range.end],
        ],
      },
    );
    for (const table of ["attendanceRecords", "sessionStudents"]) {
      assert.deepEqual(
        reads
          .filter((read) => read.table === table)
          .map((read) => [read.index, read.constraints]),
        [
          ["bySession", [["eq", "session", "start"]]],
          ["bySession", [["eq", "session", "end"]]],
        ],
      );
    }
  });
  it("loads options including past seasons without reading enrollments or rosters", async () => {
    const { ctx, reads } = fixture();
    const options = await run<{ seasons: { _id: string }[] }>(
      adminAttendanceReportOptions,
      ctx,
      {},
    );
    assert.equal(options.seasons[0]._id, "past");
    assert.deepEqual(reads.map((read) => read.table).sort(), [
      "groups",
      "seasons",
    ]);
  });
});
