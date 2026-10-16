import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
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

const { checkWeeklyAbsences } = await import("../convex/absenceAlerts");
const { absenceWeekResult, attendanceWeek, shiftDate } = await import(
  "../shared/absence-alerts"
);
type Row = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
  table: string;
};
type Attendance = "present" | "late" | "absent" | "excused";

function fixture() {
  const rows: Row[] = [];
  const pushes: unknown[] = [];
  const reads: Array<{
    table: string;
    index?: string;
    bounds: Array<[string, string, unknown]>;
    ids: string[];
  }> = [];
  let sequence = 0;
  function add(
    table: string,
    value: Record<string, unknown>,
    id = `${table}:${++sequence}`,
  ) {
    const row = { ...value, table, _id: id, _creationTime: sequence };
    rows.push(row);
    return row;
  }
  function student(id = "student") {
    add(
      "students",
      { firstName: "Ada", lastName: "Test", status: "active" },
      id,
    );
    add("classEnrollments", {
      classId: "class",
      student: id,
      status: "enrolled",
      startDate: "2026-01-01",
    });
    return id;
  }
  add("users", { roles: ["admin"] }, "admin");
  add("users", { roles: ["admin"] }, "admin2");
  add("users", { roles: ["staff"] }, "staff");
  add("users", { roles: ["member"] }, "member");
  add("classes", { status: "active" }, "class");
  student();

  function session(
    date: string,
    status: Attendance | null = "absent",
    extra: Record<string, unknown> = {},
    studentId = "student",
  ) {
    const session = add("sessions", {
      date,
      classId: "class",
      active: true,
      status: "scheduled",
      ...extra,
    });
    if (status)
      add("attendanceRecords", {
        session: session._id,
        student: studentId,
        status,
        markedAt: 0,
      });
    return session;
  }
  const db = {
    get: async (id: string) => rows.find((row) => row._id === id) ?? null,
    insert: async (table: string, value: Record<string, unknown>) =>
      add(table, value)._id,
    patch: async (id: string, value: Record<string, unknown>) =>
      Object.assign(rows.find((row) => row._id === id)!, value),
    delete: async (id: string) => {
      rows.splice(
        rows.findIndex((row) => row._id === id),
        1,
      );
    },
    query(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const bounds: Array<[string, string, unknown]> = [];
      let index: string | undefined;
      const range = {
        eq(field: string, value: unknown) {
          bounds.push(["eq", field, value]);
          filters.push((row) => row[field] === value);
          return range;
        },
        gte(field: string, value: string) {
          bounds.push(["gte", field, value]);
          filters.push((row) => String(row[field]) >= value);
          return range;
        },
        lt(field: string, value: string) {
          bounds.push(["lt", field, value]);
          filters.push((row) => String(row[field]) < value);
          return range;
        },
      };
      function collect() {
        const results = rows.filter(
          (row) => row.table === table && filters.every((f) => f(row)),
        );
        reads.push({
          table,
          index,
          bounds,
          ids: results.map((row) => row._id),
        });
        return results;
      }
      const query = {
        withIndex(name: string, filter: (q: typeof range) => unknown) {
          index = name;
          filter(range);
          return query;
        },
        collect: async () => collect(),
        first: async () => collect()[0] ?? null,
        unique: async () => {
          const result = collect();
          assert.ok(result.length <= 1);
          return result[0] ?? null;
        },
      };
      return query;
    },
  };
  const ctx = {
    db,
    scheduler: {
      runAfter: async (...args: unknown[]) => {
        pushes.push(args);
      },
    },
  };
  async function run(date = "2026-09-28T14:00:00Z") {
    return await (
      checkWeeklyAbsences as unknown as {
        _handler: (
          ctx: unknown,
          args: { now: number },
        ) => Promise<{ alertCount: number; sessionCount: number }>;
      }
    )._handler(ctx, { now: Date.parse(date) });
  }
  function threeWeeks() {
    return ["2026-09-07", "2026-09-14", "2026-09-21"].map((date) =>
      session(date),
    );
  }
  const notifications = () =>
    rows.filter((row) => row.table === "notifications");
  return {
    rows,
    add,
    student,
    session,
    run,
    threeWeeks,
    notifications,
    pushes,
    reads,
  };
}

describe("weekly absence alerts", () => {
  it("exposes only an internal scheduled mutation", () => {
    assert.equal(
      (checkWeeklyAbsences as unknown as { isInternal: boolean }).isInternal,
      true,
    );
  });

  it("does not store state for students with no absences or fetch recipients on empty runs", async () => {
    const f = fixture();
    await f.run();
    assert.equal(f.reads.filter((read) => read.table === "users").length, 0);
    for (const date of ["2026-09-07", "2026-09-14", "2026-09-21"])
      f.session(date, "present");
    await f.run();
    assert.equal(
      f.rows.filter((row) => row.table === "absenceAlertStates").length,
      0,
    );
  });

  it("removes unnecessary state once all remembered absences have been corrected", async () => {
    const f = fixture();
    f.threeWeeks();
    await f.run();
    for (const row of f.rows.filter((row) => row.table === "attendanceRecords"))
      row.status = "excused";
    await f.run();
    assert.equal(
      f.rows.filter((row) => row.table === "absenceAlertStates").length,
      0,
    );
  });

  it("uses Monday calendar weeks across Sunday, year boundaries and DST", () => {
    assert.equal(attendanceWeek("2026-09-27"), "2026-09-21");
    assert.equal(attendanceWeek("2026-09-28"), "2026-09-28");
    assert.equal(attendanceWeek("2027-01-01"), "2026-12-28");
    assert.equal(shiftDate("2026-11-02", -7), "2026-10-26");
  });

  it("classifies only wholly absent weeks; an excused entry accounts for the week", () => {
    assert.equal(absenceWeekResult([]), undefined);
    assert.equal(absenceWeekResult(["absent", undefined]), "unknown");
    assert.equal(absenceWeekResult(["absent", "absent"]), "absent");
    for (const status of ["present", "late", "excused"] as const) {
      assert.equal(absenceWeekResult(["absent", undefined, status]), "reset");
    }
  });

  it("alerts only admins, schedules push, links the report and is idempotent", async () => {
    const f = fixture();
    f.threeWeeks();
    assert.equal((await f.run()).alertCount, 1);
    assert.deepEqual(
      f.notifications().map((row) => row.recipientUserId),
      ["admin", "admin2"],
    );
    assert.equal(f.notifications()[0].href, "/admin/students/student/report");
    assert.equal(f.notifications()[0].type, "attendance.absence_streak");
    assert.equal(f.pushes.length, 2);
    assert.equal((await f.run()).alertCount, 0);
    f.session("2026-09-28");
    assert.equal((await f.run("2026-10-05T14:00:00Z")).alertCount, 0);
    assert.equal(f.notifications().length, 2);
    assert.equal(
      (
        f.rows.find((row) => row.table === "absenceAlertStates")!
          .weeks as unknown[]
      ).length,
      3,
    );
  });

  for (const status of ["present", "late", "excused"] as const) {
    it(`${status} in any other class resets the whole-student streak`, async () => {
      const f = fixture();
      f.threeWeeks();
      f.add(
        "classes",
        { status: "active", enrollmentMode: "per_session" },
        "other",
      );
      f.session("2026-09-16", status, { classId: "other" });
      assert.equal((await f.run()).alertCount, 0);
    });
  }

  it("three sessions in one week are not three weeks", async () => {
    const f = fixture();
    for (const date of ["2026-09-21", "2026-09-22", "2026-09-23"])
      f.session(date);
    assert.equal((await f.run()).alertCount, 0);
  });

  it("unmarked attendance blocks an alert; late marking is picked up next run", async () => {
    const f = fixture();
    f.threeWeeks();
    const unmarked = f.session("2026-09-16", null);
    assert.equal((await f.run()).alertCount, 0);
    f.add("attendanceRecords", {
      session: unmarked._id,
      student: "student",
      status: "absent",
    });
    assert.equal((await f.run()).alertCount, 1);
  });

  it("does not count inactive/cancelled sessions or archived classes", async () => {
    for (const extra of [
      { active: false },
      { status: "cancelled" },
      { classId: "archived" },
    ]) {
      const f = fixture();
      f.add("classes", { status: "archived" }, "archived");
      f.session("2026-09-07");
      f.session("2026-09-14");
      f.session("2026-09-21", "absent", extra);
      assert.equal((await f.run()).alertCount, 0);
    }
  });

  it("preserves earlier teaching weeks through a long closure and revalidates them", async () => {
    const f = fixture();
    f.session("2026-09-07");
    f.session("2026-09-14");
    await f.run("2026-09-21T14:00:00Z");
    await f.run("2026-10-12T14:00:00Z");
    f.session("2026-10-12");
    assert.equal((await f.run("2026-10-19T14:00:00Z")).alertCount, 1);
    assert.deepEqual(f.notifications()[0].metadata, {
      weeks: ["2026-09-07", "2026-09-14", "2026-10-12"],
    });
  });

  it("a correction to a saved pre-holiday week prevents a false alert", async () => {
    const f = fixture();
    const old = f.session("2026-09-07");
    f.session("2026-09-14");
    await f.run("2026-09-21T14:00:00Z");
    f.rows.find(
      (row) => row.table === "attendanceRecords" && row.session === old._id,
    )!.status = "excused";
    f.session("2026-10-12");
    assert.equal((await f.run("2026-10-19T14:00:00Z")).alertCount, 0);
  });

  it("allows a new alert after an excused week followed by three absent weeks", async () => {
    const f = fixture();
    f.threeWeeks();
    await f.run();
    f.session("2026-09-28", "excused");
    await f.run("2026-10-05T14:00:00Z");
    for (const date of ["2026-10-05", "2026-10-12", "2026-10-19"]) {
      f.session(date);
      await f.run(`${shiftDate(date, 7)}T14:00:00Z`);
    }
    assert.equal(f.notifications().length, 4);
    assert.equal((await f.run("2026-10-26T14:00:00Z")).alertCount, 0);
  });

  it("handles a correction inside an already-notified streak", async () => {
    const f = fixture();
    const sessions = f.threeWeeks();
    await f.run();
    f.rows.find(
      (row) =>
        row.table === "attendanceRecords" && row.session === sessions[1]._id,
    )!.status = "present";
    await f.run();
    f.session("2026-09-28");
    await f.run("2026-10-05T14:00:00Z");
    f.session("2026-10-05");
    assert.equal((await f.run("2026-10-12T14:00:00Z")).alertCount, 1);
  });

  it("honors enrollment dates, per-session bookings, trials and added students", async () => {
    for (const source of ["signup", "trial", "addition", "dropped"] as const) {
      const f = fixture();
      const enrollment = f.rows.find(
        (row) => row.table === "classEnrollments",
      )!;
      enrollment.status = "cancelled";
      if (source === "signup")
        f.rows.find((row) => row._id === "class")!.enrollmentMode =
          "per_session";
      if (source === "dropped")
        Object.assign(enrollment, { status: "dropped", endDate: "2026-09-21" });
      const sessions = f.threeWeeks();
      for (const session of sessions) {
        if (source === "signup" || source === "trial") {
          f.add("classSessionSignups", {
            session: session._id,
            student: "student",
            status: "enrolled",
            ...(source === "trial" ? { trialRequestId: "trial" } : {}),
          });
        } else if (source === "addition") {
          f.add("sessionStudents", {
            session: session._id,
            student: "student",
          });
        }
      }
      assert.equal((await f.run()).alertCount, 1, source);
    }
    const f = fixture();
    f.rows.find((row) => row.table === "classEnrollments")!.startDate =
      "2026-09-14";
    f.threeWeeks();
    assert.equal((await f.run()).alertCount, 0);
  });

  it("excludes inactive students and does not count a waitlisted booking", async () => {
    const f = fixture();
    f.threeWeeks();
    f.rows.find((row) => row._id === "student")!.status = "inactive";
    assert.equal((await f.run()).alertCount, 0);
    const g = fixture();
    g.rows.find((row) => row._id === "class")!.enrollmentMode = "per_session";
    for (const session of g.threeWeeks()) {
      g.add("classSessionSignups", {
        session: session._id,
        student: "student",
        status: "waitlisted",
      });
    }
    assert.equal((await g.run()).alertCount, 0);
  });

  it("bounds session reads, shares attendance reads, and fetches admins only once when needed", async () => {
    const f = fixture();
    f.student("second");
    for (const session of f.threeWeeks())
      f.add("attendanceRecords", {
        session: session._id,
        student: "second",
        status: "absent",
      });
    const old = f.session("2020-01-01");
    const current = f.session("2026-09-28");
    assert.equal((await f.run()).alertCount, 2);
    assert.equal(
      f.reads.filter((read) => read.table === "attendanceRecords").length,
      3,
    );
    assert.equal(f.reads.filter((read) => read.table === "users").length, 1);
    for (const read of f.reads.filter((read) => read.table === "sessions")) {
      assert.equal(read.index, "byDate");
      assert.equal(read.bounds.length, 2);
      assert.ok(!read.ids.includes(old._id) && !read.ids.includes(current._id));
    }
    f.reads.length = 0;
    await f.run();
    assert.equal(f.reads.filter((read) => read.table === "users").length, 0);
    assert.ok(
      f.reads
        .filter((read) => read.table === "absenceAlertStates")
        .every((read) => read.index === "byStudent"),
    );
  });

  it("uses studio-local completed weeks even near UTC midnight", async () => {
    const f = fixture();
    f.threeWeeks();
    // Still Sunday in New York: September 21 is not a completed week yet.
    assert.equal((await f.run("2026-09-28T01:00:00Z")).alertCount, 0);
    assert.equal((await f.run("2026-09-28T14:00:00Z")).alertCount, 1);
  });
});
