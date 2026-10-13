import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../convex/_generated/api";

// Run the real Convex handlers locally, without deploying or accessing live data.
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

const {
  getMyStudent,
  getBuddySheetUrl,
  adminGetStudent,
  adminListBuddyCandidates,
  adminCreateBuddyConnection,
  adminUpdateBuddyConnection,
  adminGenerateBuddySheetUploadUrl,
  adminSaveBuddySheet,
} = await import("../convex/classes");
const { buddySheetFileName, validateBuddySheetFile, MAX_BUDDY_SHEET_SIZE } =
  await import("../shared/buddy-sheets");
type Row = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
  table: string;
};
type StudentData = NonNullable<
  FunctionReturnType<typeof api.classes.getMyStudent>
>;

function fixture() {
  const rows: Row[] = [];
  const storageReads: string[] = [];
  const missingFiles = new Set<string>();
  const deletedFiles: string[] = [];
  let generatedId = 0;
  let transactionQueue = Promise.resolve();
  let actor: string | null = "member";
  function add(
    table: string,
    id: string,
    values: Record<string, unknown> = {},
  ) {
    const row: Row = {
      _id: id,
      _creationTime: rows.length + 1,
      table,
      ...values,
    };
    rows.push(row);
    return row;
  }
  add("users", "member", { roles: ["member"] });
  add("users", "other", { roles: ["member"] });
  add("users", "admin", { roles: ["admin"] });
  add("students", "student", {
    firstName: "Sam",
    lastName: "Student",
    status: "active",
  });
  add("students", "buddy", {
    firstName: "Blair",
    lastName: "Buddy",
    preferredName: "B",
    photo: "photo",
    buddySheet: "sheet",
    status: "active",
    notes: "Private student notes",
    allergies: "Private allergies",
    school: "Private school",
  });
  const contact = add("studentContacts", "contact", {
    student: "student",
    user: "member",
    canManage: true,
  });
  const ctx = {
    auth: {
      getUserIdentity: async () =>
        actor ? { subject: `${actor}|session` } : null,
    },
    storage: {
      generateUploadUrl: async () => "https://storage.example/upload",
      delete: async (id: string) => {
        deletedFiles.push(id);
        missingFiles.add(id);
      },
      getUrl: async (id: string) => {
        storageReads.push(id);
        return missingFiles.has(id) ? null : `https://storage.example/${id}`;
      },
    },
    db: {
      system: {
        get: async (id: string) =>
          rows.find((row) => row.table === "_storage" && row._id === id) ??
          null,
      },
      insert: async (table: string, values: Record<string, unknown>) =>
        add(table, `generated-${++generatedId}`, values)._id,
      patch: async (id: string, values: Record<string, unknown>) => {
        Object.assign(rows.find((row) => row._id === id)!, values);
      },
      get: async (id: string) =>
        structuredClone(rows.find((row) => row._id === id) ?? null),
      query(table: string) {
        const filters: Array<(row: Row) => boolean> = [];
        const range = {
          eq(field: string, value: unknown) {
            filters.push((row) => row[field] === value);
            return range;
          },
        };
        type Predicate = (row: Row) => boolean;
        const expression = {
          field: (name: string) => (row: Row) => row[name],
          eq:
            (field: (row: Row) => unknown, value: unknown): Predicate =>
            (row) =>
              field(row) === value,
          or:
            (...predicates: Predicate[]): Predicate =>
            (row) =>
              predicates.some((p) => p(row)),
        };
        let descending = false;
        const collect = () =>
          rows
            .filter(
              (row) => row.table === table && filters.every((f) => f(row)),
            )
            .sort((a, b) =>
              descending
                ? b._creationTime - a._creationTime
                : a._creationTime - b._creationTime,
            );
        const query = {
          filter: (predicate: (q: typeof expression) => Predicate) => {
            filters.push(predicate(expression));
            return query;
          },
          first: async () => collect()[0] ?? null,
          order: (direction: string) => {
            descending = direction === "desc";
            return query;
          },
          take: async (count: number) => collect().slice(0, count),
          withIndex(_name: string, filter: (q: typeof range) => unknown) {
            filter(range);
            return query;
          },
          collect: async () => collect(),
        };
        return query;
      },
    },
  };
  async function call<T>(fn: unknown, args: unknown): Promise<T> {
    return (
      fn as { _handler: (ctx: unknown, args: unknown) => Promise<T> }
    )._handler(ctx, args);
  }
  // Convex commits mutations serializably; queue local handler calls to model
  // committed transactions without relying on a live deployment.
  function mutate<T = unknown>(fn: unknown, args: unknown) {
    const transaction = transactionQueue.then(() => call<T>(fn, args));
    transactionQueue = transaction.then(
      () => undefined,
      () => undefined,
    );
    return transaction;
  }
  return {
    mutate,
    call,
    deletedFiles,
    adminDetail: (student = "student") =>
      call<FunctionReturnType<typeof api.classes.adminGetStudent>>(
        adminGetStudent,
        { student },
      ),
    candidates: () =>
      call<FunctionReturnType<typeof api.classes.adminListBuddyCandidates>>(
        adminListBuddyCandidates,
        {},
      ),
    add,
    rows,
    contact,
    storageReads,
    missingFiles,
    actor: (value: string | null) => {
      actor = value;
    },
    detail: (student = "student") =>
      call<StudentData | null>(getMyStudent, { student }),
    pdf: (storageId = "sheet", student = "student") =>
      call<string | null>(getBuddySheetUrl, { student, storageId }),
    assign: (id = "assignment", values: Record<string, unknown> = {}) =>
      add("buddies", id, {
        student: "student",
        buddy: "buddy",
        current: true,
        ...values,
      }),
  };
}

describe("member student buddies", () => {
  it("has no buddy tab data without assignments", async () => {
    const f = fixture();
    const result = await f.detail();
    assert.equal(result?.hasBuddyAssignments, false);
    assert.deepEqual(result?.buddies, []);
    assert.equal(await f.pdf(), null);
  });

  it("merges both directions in creation order, preserving separate assignments and history", async () => {
    const f = fixture();
    f.assign("new", { _creationTime: 30 });
    f.assign("old", {
      student: "buddy",
      buddy: "student",
      current: false,
      year: "2025",
      notes: "Assignment notes",
      _creationTime: 10,
    });
    f.assign("middle", { _creationTime: 20 });
    f.assign("unrelated", {
      student: "someone",
      buddy: "else",
      _creationTime: 5,
    });
    const result = await f.detail();
    assert.equal(result?.hasBuddyAssignments, true);
    assert.deepEqual(
      result?.buddies.map((row) => row._id),
      ["old", "middle", "new"],
    );
    assert.deepEqual(result?.buddies[0], {
      _id: "old",
      current: false,
      year: "2025",
      notes: "Assignment notes",
      buddy: {
        firstName: "Blair",
        lastName: "Buddy",
        preferredName: "B",
        photoUrl: "https://storage.example/photo",
        buddySheet: "sheet",
      },
    });
    assert.ok(result?.buddies.every((row) => row.buddy?.firstName === "Blair"));
    // The strict equality above guards against returning private buddy student fields.
    assert.equal(await f.detail("buddy"), null);
  });

  it("deduplicates the same junction returned by both indexes", async () => {
    const f = fixture();
    f.assign("self", { buddy: "student" });
    assert.equal((await f.detail())?.buddies.length, 1);
  });

  it("keeps missing-student assignments and supports absent photos and sheets", async () => {
    const f = fixture();
    f.assign("missing", { buddy: "deleted" });
    f.add("students", "minimal", { firstName: "Alex", lastName: "Buddy" });
    f.assign("minimal-assignment", { buddy: "minimal", current: false });
    const result = await f.detail();
    assert.equal(result?.hasBuddyAssignments, true);
    assert.equal(result?.buddies[0].buddy, null);
    assert.equal(result?.buddies[1].buddy?.photoUrl, null);
    assert.equal(result?.buddies[1].buddy?.buddySheet, undefined);
    assert.equal(await f.pdf(), null);
  });

  it("retains existing enrollment filtering and per-session data", async () => {
    const f = fixture();
    f.add("classes", "class", {
      title: "Ballet",
      scheduleSummary: "Monday",
      status: "published",
    });
    for (const status of [
      "enrolled",
      "pending",
      "waitlisted",
      "dropped",
      "declined",
    ]) {
      f.add("classEnrollments", status, {
        student: "student",
        classId: "class",
        status,
      });
    }
    f.add("classes", "session-class", {
      title: "Workshop",
      enrollmentMode: "per_session",
      status: "published",
      timezone: "America/New_York",
    });
    f.add("sessions", "session", {
      classId: "session-class",
      date: "2099-01-01",
      active: true,
      status: "scheduled",
    });
    f.add("classSessionSignups", "signup", {
      student: "student",
      classId: "session-class",
      session: "session",
      status: "enrolled",
    });
    const result = await f.detail();
    assert.deepEqual(
      result?.enrollments.map((row) => row.status),
      ["enrolled", "pending", "waitlisted"],
    );
    assert.equal(
      result?.perSessionClasses[0].selectedSessions[0].session._id,
      "session",
    );
    assert.equal(result?.perSessionClasses[0].canSelfManage, true);
  });
});

describe("buddy sheet access", () => {
  it("resolves current and past buddy sheets from either relationship direction", async () => {
    for (const reverse of [false, true]) {
      const f = fixture();
      f.assign(
        "assignment",
        reverse ? { student: "buddy", buddy: "student", current: false } : {},
      );
      assert.equal(await f.pdf(), "https://storage.example/sheet");
      assert.deepEqual(f.storageReads, ["sheet"]);
    }
  });

  it("rejects anonymous users, unrelated accounts, and contacts without management access", async () => {
    const f = fixture();
    f.assign();
    for (const actor of [null, "other"]) {
      f.actor(actor);
      assert.equal(await f.detail(), null);
      assert.equal(await f.pdf(), null);
    }
    f.actor("member");
    f.contact.canManage = false;
    assert.equal(await f.detail(), null);
    assert.equal(await f.pdf(), null);
    assert.deepEqual(f.storageReads, []);
  });

  it("preserves admin access but still requires the sheet to match an assignment", async () => {
    const f = fixture();
    f.actor("admin");
    f.assign();
    assert.ok(await f.detail());
    assert.equal(await f.pdf(), "https://storage.example/sheet");
    assert.equal(await f.pdf("unrelated-file"), null);
  });

  it("rejects arbitrary IDs, photos, replaced sheets, and removed relationships", async () => {
    const f = fixture();
    const assignment = f.assign();
    assert.equal(await f.pdf("arbitrary"), null);
    assert.equal(await f.pdf("photo"), null);
    f.rows.find((row) => row._id === "buddy")!.buddySheet = "replacement";
    assert.equal(await f.pdf(), null);
    assert.equal(
      await f.pdf("replacement"),
      "https://storage.example/replacement",
    );
    f.rows.splice(f.rows.indexOf(assignment), 1);
    assert.equal(await f.pdf("replacement"), null);
    assert.deepEqual(f.storageReads, ["replacement"]);
  });

  it("returns unavailable for deleted storage and deleted viewed students", async () => {
    const f = fixture();
    f.assign();
    f.missingFiles.add("sheet");
    assert.equal(await f.pdf(), null);
    f.rows.splice(
      f.rows.findIndex((row) => row._id === "student"),
      1,
    );
    assert.equal(await f.detail(), null);
    assert.equal(await f.pdf(), null);
    assert.deepEqual(f.storageReads, ["sheet"]);
  });
});

describe("admin buddy connections", () => {
  const values = { student: "student", buddy: "buddy", current: true };

  it("requires admin access for detail, picker, connections, and uploads", async () => {
    const f = fixture();
    f.add("users", "staff", { roles: ["staff"] });
    for (const actor of [null, "member", "staff"]) {
      f.actor(actor);
      for (const [fn, args] of [
        [adminGetStudent, { student: "student" }],
        [adminListBuddyCandidates, {}],
        [adminCreateBuddyConnection, values],
        [adminUpdateBuddyConnection, { ...values, connection: "missing" }],
        [adminGenerateBuddySheetUploadUrl, { student: "student" }],
        [
          adminSaveBuddySheet,
          {
            student: "student",
            storageId: "new",
            fileName: "sheet.pdf",
            expectedStorageId: null,
          },
        ],
      ])
        await assert.rejects(() => f.call(fn, args));
    }
    assert.equal(f.rows.filter((row) => row.table === "buddies").length, 0);
  });

  it("returns lightweight candidates and bidirectional cards including missing profiles", async () => {
    const f = fixture();
    f.actor("admin");
    f.assign("reverse", { student: "buddy", buddy: "student", current: false });
    f.assign("missing", { buddy: "gone" });
    const candidates = await f.candidates();
    assert.deepEqual(candidates[0], {
      _id: "buddy",
      firstName: "Blair",
      lastName: "Buddy",
      preferredName: "B",
      status: "active",
    });
    const detail = await f.adminDetail();
    assert.equal(detail?.buddies[0].buddyId, "buddy");
    assert.equal(
      detail?.buddies[0].buddyProfile?.photoUrl,
      "https://storage.example/photo",
    );
    assert.equal(detail?.buddies[1].buddyProfile, null);
  });

  it("adds and edits from the reverse side, updating member views and both logs", async () => {
    const f = fixture();
    f.actor("admin");
    const id = await f.mutate<string>(adminCreateBuddyConnection, {
      ...values,
      year: " 2026–2027 ",
      notes: " Shared notes ",
    });
    await f.mutate(adminUpdateBuddyConnection, {
      student: "buddy",
      buddy: "student",
      connection: id,
      current: false,
    });
    const fromStudent = await f.adminDetail();
    const fromBuddy = await f.adminDetail("buddy");
    assert.equal(fromStudent?.buddies[0].current, false);
    assert.equal(fromBuddy?.buddies[0].current, false);
    assert.equal(fromStudent?.buddies[0].year, undefined);
    assert.equal(fromStudent?.buddies[0].notes, undefined);
    assert.equal(f.rows.filter((row) => row.table === "activityLog").length, 4);
    f.actor("member");
    assert.equal((await f.detail())?.buddies[0].current, false);
  });

  it("rejects self, missing, duplicate/reversed pairs and concurrent duplicate submissions", async () => {
    const f = fixture();
    f.actor("admin");
    await assert.rejects(
      () =>
        f.mutate(adminCreateBuddyConnection, { ...values, buddy: "student" }),
      /own buddy/,
    );
    await assert.rejects(
      () => f.mutate(adminCreateBuddyConnection, { ...values, buddy: "gone" }),
      /no longer exists/,
    );
    const outcomes = await Promise.allSettled([
      f.mutate(adminCreateBuddyConnection, values),
      f.mutate(adminCreateBuddyConnection, {
        ...values,
        student: "buddy",
        buddy: "student",
      }),
    ]);
    assert.deepEqual(
      outcomes.map((r) => r.status),
      ["fulfilled", "rejected"],
    );
    await assert.rejects(
      () => f.mutate(adminCreateBuddyConnection, values),
      /already have/,
    );
    assert.equal(f.rows.filter((row) => row.table === "buddies").length, 1);
  });

  it("allows legacy duplicate metadata edits but rejects changing to an existing pair", async () => {
    const f = fixture();
    f.actor("admin");
    f.assign("first");
    f.assign("reverse", { student: "buddy", buddy: "student" });
    f.add("students", "third", { firstName: "Third", lastName: "Student" });
    f.assign("third-connection", { buddy: "third" });
    await f.mutate(adminUpdateBuddyConnection, {
      ...values,
      connection: "reverse",
      current: false,
    });
    await assert.rejects(
      () =>
        f.mutate(adminUpdateBuddyConnection, {
          ...values,
          connection: "reverse",
          buddy: "third",
        }),
      /already have/,
    );
    assert.equal(f.rows.filter((row) => row.table === "buddies").length, 3);
  });

  it("corrects the buddy and logs all affected students without moving the viewed endpoint", async () => {
    const f = fixture();
    f.actor("admin");
    f.assign("reverse", { student: "buddy", buddy: "student" });
    f.add("students", "third", { firstName: "Third", lastName: "Student" });
    await f.mutate(adminUpdateBuddyConnection, {
      ...values,
      connection: "reverse",
      buddy: "third",
    });
    const row = f.rows.find((row) => row._id === "reverse");
    assert.equal(row?.student, "student");
    assert.equal(row?.buddy, "third");
    assert.equal((await f.adminDetail("buddy"))?.buddies.length, 0);
    assert.deepEqual(
      f.rows
        .filter((row) => row.table === "activityLog")
        .map((row) => row.entityId)
        .sort(),
      ["buddy", "student", "third"],
    );
    await assert.rejects(
      () =>
        f.mutate(adminUpdateBuddyConnection, {
          student: "buddy",
          buddy: "third",
          connection: "reverse",
          current: false,
        }),
      /no longer belongs/,
    );
  });
});

describe("admin buddy sheet uploads", () => {
  const upload = {
    student: "student",
    storageId: "new",
    fileName: "new-sheet.pdf",
    expectedStorageId: null,
  };
  function uploadFixture() {
    const f = fixture();
    f.actor("admin");
    f.add("_storage", "new", { contentType: "application/pdf", size: 1024 });
    return f;
  }

  it("validates PDF size/type and provides a legacy filename fallback", () => {
    assert.equal(buddySheetFileName(), "Buddy sheet.pdf");
    assert.equal(buddySheetFileName(" dance.pdf "), "dance.pdf");
    assert.equal(
      validateBuddySheetFile({
        type: "application/pdf",
        size: MAX_BUDDY_SHEET_SIZE,
      }),
      null,
    );
    assert.ok(validateBuddySheetFile({ type: "image/png", size: 1024 }));
    assert.ok(validateBuddySheetFile({ type: "application/pdf", size: 0 }));
    assert.ok(
      validateBuddySheetFile({
        type: "application/pdf",
        size: MAX_BUDDY_SHEET_SIZE + 1,
      }),
    );
  });

  it("issues upload URLs and allows an admin to view an unconnected student's own sheet", async () => {
    const f = uploadFixture();
    assert.equal(
      await f.mutate(adminGenerateBuddySheetUploadUrl, { student: "student" }),
      "https://storage.example/upload",
    );
    await f.mutate(adminSaveBuddySheet, upload);
    assert.equal(await f.pdf("new"), "https://storage.example/new");
    assert.equal(
      (await f.adminDetail())?.student.buddySheetFileName,
      "new-sheet.pdf",
    );
    f.actor("member");
    assert.equal(await f.pdf("new"), null);
  });

  it("rejects invalid storage metadata and retains the old sheet on failure", async () => {
    for (const metadata of [
      null,
      { contentType: "image/png", size: 100 },
      { contentType: "application/pdf", size: 0 },
      { contentType: "application/pdf", size: MAX_BUDDY_SHEET_SIZE + 1 },
    ]) {
      const f = fixture();
      f.actor("admin");
      const student = f.rows.find((row) => row._id === "student")!;
      student.buddySheet = "old";
      student.buddySheetFileName = "old.pdf";
      if (metadata) f.add("_storage", "new", metadata);
      await assert.rejects(() =>
        f.mutate(adminSaveBuddySheet, { ...upload, expectedStorageId: "old" }),
      );
      assert.equal(student.buddySheet, "old");
      assert.equal(student.buddySheetFileName, "old.pdf");
      assert.deepEqual(f.deletedFiles, []);
    }
  });

  it("replaces the reference/name, deletes unreferenced old storage, and records no version history", async () => {
    const f = uploadFixture();
    const student = f.rows.find((row) => row._id === "student")!;
    student.buddySheet = "old";
    await f.mutate(adminSaveBuddySheet, {
      ...upload,
      expectedStorageId: "old",
    });
    assert.equal(student.buddySheet, "new");
    assert.deepEqual(f.deletedFiles, ["old"]);
    const logs = f.rows.filter((row) => row.table === "activityLog");
    assert.equal(logs.length, 1);
    assert.equal(JSON.stringify(logs).includes("old"), false);
  });

  it("preserves old storage still used by any existing file reference", async () => {
    for (const [table, values] of [
      ["students", { buddySheet: "old" }],
      ["students", { photo: "old" }],
      ["groups", { document: "old" }],
      ["documents", { document: "old" }],
      ["docuBulletins", { document: "old" }],
      ["users", { image: "https://storage.example/old" }],
      ["bulletin", { image: "old" }],
    ] as const) {
      const f = uploadFixture();
      f.rows.find((row) => row._id === "student")!.buddySheet = "old";
      f.add(table, "reference", values);
      await f.mutate(adminSaveBuddySheet, {
        ...upload,
        expectedStorageId: "old",
      });
      assert.deepEqual(f.deletedFiles, [], table);
    }
  });

  it("rejects a stale replacement, including simultaneous first uploads", async () => {
    const f = uploadFixture();
    f.add("_storage", "second", { contentType: "application/pdf", size: 1024 });
    const outcomes = await Promise.allSettled([
      f.mutate(adminSaveBuddySheet, upload),
      f.mutate(adminSaveBuddySheet, { ...upload, storageId: "second" }),
    ]);
    assert.deepEqual(
      outcomes.map((r) => r.status),
      ["fulfilled", "rejected"],
    );
    assert.equal(
      f.rows.find((row) => row._id === "student")?.buddySheet,
      "new",
    );
    assert.deepEqual(f.deletedFiles, []);
  });
});
