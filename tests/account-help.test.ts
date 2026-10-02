import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import {
  ACCOUNT_HELP_STORAGE_KEY,
  accountHelpSchema,
  createAccountHelpStore,
  parseAccountHelpContext,
  reserveAccountHelpAttempts,
} from "../shared/account-help.ts";

describe("account help context", () => {
  it("keeps authentication route parameters but never saves codes or passwords", () => {
    const context = parseAccountHelpContext({
      email: "friend@example.com",
      flow: "signup",
      returnTo:
        "/register?invite=invite-token&referral=friend-token&redirect=%2Ftrial&code=12345678",
      password: "secret",
      code: "12345678",
    });
    assert.deepEqual(context, {
      email: "friend@example.com",
      flow: "signup",
      returnTo:
        "/register?invite=invite-token&referral=friend-token&redirect=%2Ftrial",
    });
  });
  it("allows each code-entry flow and rejects unsafe or mismatched destinations", () => {
    for (const [flow, returnTo] of [
      ["signup", "/register/"],
      ["login", "/login?redirect=%2Fhome"],
      ["password_reset", "/reset-password"],
      ["account_password_reset", "/reset-password?accountChallenge=challenge"],
    ]) {
      assert.equal(
        parseAccountHelpContext({ flow, returnTo, email: "person@example.com" })
          ?.returnTo,
        returnTo,
      );
    }
    for (const returnTo of [
      "https://evil.example/login",
      "//evil.example/login",
      "/\\evil.example/login",
      "/account-help",
      "/register",
    ]) {
      assert.equal(
        parseAccountHelpContext({
          email: "person@example.com",
          flow: "login",
          returnTo,
        }),
        null,
      );
    }
    assert.equal(
      parseAccountHelpContext({
        email: "person@example.com",
        flow: "password_reset",
        returnTo: "/reset-password?accountChallenge=other",
      }),
      null,
    );
    assert.equal(
      parseAccountHelpContext({
        email: "person@example.com",
        flow: "account_password_reset",
        returnTo: "/reset-password",
      }),
      null,
    );
  });
  it("survives refresh and clears completed or cancelled flow context", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
    const first = createAccountHelpStore(() => storage);
    const context = {
      email: "typo@example.com",
      flow: "login" as const,
      returnTo: "/login?redirect=%2Fpayments",
    };
    first.save(context);
    const refreshed = createAccountHelpStore(() => storage);
    assert.deepEqual(refreshed.read(), context);
    const submitted = accountHelpSchema.parse({
      name: "Visitor",
      email: "correct@example.com",
      flow: "login",
    });
    assert.equal(submitted.email, "correct@example.com");
    assert.equal(refreshed.read()?.email, "typo@example.com");
    refreshed.clear();
    assert.equal(refreshed.read(), null);
    assert.equal(data.has(ACCOUNT_HELP_STORAGE_KEY), false);
  });
  it("uses memory when browser storage is blocked, including clearing stale data", () => {
    const store = createAccountHelpStore(() => {
      throw new Error("Storage blocked");
    });
    const context = {
      email: "person@example.com",
      flow: "password_reset" as const,
      returnTo: "/reset-password",
    };
    store.save(context);
    assert.deepEqual(store.read(), context);
    store.clear();
    assert.equal(store.read(), null);
  });
  it("tolerates missing and corrupt browser storage", () => {
    assert.equal(createAccountHelpStore(() => null).read(), null);
    assert.equal(
      createAccountHelpStore(() => ({
        getItem: () => "invalid JSON",
        setItem() {},
        removeItem() {},
      })).read(),
      null,
    );
  });
});

describe("account help validation and limits", () => {
  it("accepts a minimal request and trims optional fields", () => {
    assert.deepEqual(
      accountHelpSchema.parse({
        name: " Visitor ",
        email: " person@example.com ",
        phone: " 555-555-1234 ",
        message: " Please call ",
        flow: "signup",
      }),
      {
        name: "Visitor",
        email: "person@example.com",
        phone: "555-555-1234",
        message: "Please call",
        flow: "signup",
      },
    );
    assert.ok(
      accountHelpSchema.safeParse({
        name: "Visitor",
        email: "person@example.com",
        flow: "unknown",
      }).success,
    );
  });
  it("rejects blank, malformed, and oversized fields", () => {
    const valid = {
      name: "Visitor",
      email: "person@example.com",
      flow: "login",
    };
    for (const patch of [
      { name: " " },
      { name: "x".repeat(121) },
      { email: "bad" },
      { email: "one@example.com\r\nBcc: two@example.com" },
      { phone: "1".repeat(41) },
      { message: "x".repeat(5001) },
      { flow: "bad" },
    ])
      assert.equal(
        accountHelpSchema.safeParse({ ...valid, ...patch }).success,
        false,
      );
  });
  it("enforces cooldown and rolling per-email/global limits at the boundaries", () => {
    const now = 4_000_000;
    assert.throws(
      () => reserveAccountHelpAttempts([now - 59_999], [], now),
      /wait a minute/,
    );
    assert.doesNotThrow(() =>
      reserveAccountHelpAttempts([now - 60_000], [], now),
    );
    assert.throws(
      () => reserveAccountHelpAttempts(Array(5).fill(now - 60_000), [], now),
      /too many/,
    );
    assert.throws(
      () => reserveAccountHelpAttempts([], Array(30).fill(now - 60_000), now),
      /too many/,
    );
    assert.deepEqual(
      reserveAccountHelpAttempts([now - 3_600_000], [now - 3_600_000], now),
      { email: [now], global: [now] },
    );
  });
});

const resendStub =
  "data:text/javascript," +
  encodeURIComponent(`
  export const messages = [];
  export let failed = false;
  export function reset(failure = false) { failed = failure; messages.length = 0; }
  export class Resend { emails = { send: async (message) => { messages.push(message); return { error: failed ? { message: 'Provider error' } : null }; } }; }
`);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "resend") return next(resendStub, context);
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && context.parentURL) {
        for (const extension of [".ts", ".js"]) {
          const url = new URL(specifier + extension, context.parentURL);
          if (existsSync(fileURLToPath(url))) return next(url.href, context);
        }
      }
      throw error;
    }
  },
});
const { sendAccountHelp, sendContactMessage } = await import(
  "../convex/contact.ts"
);
const { reserveAccountHelpSend } = await import("../convex/contactData.ts");
const transport = await import(resendStub);
const env = {
  key: process.env.RESEND_API_KEY,
  to: process.env.ACCESS_CONTACT_EMAIL,
};
before(() => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.ACCESS_CONTACT_EMAIL = "studio@example.com";
});
after(() => {
  if (env.key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = env.key;
  if (env.to === undefined) delete process.env.ACCESS_CONTACT_EMAIL;
  else process.env.ACCESS_CONTACT_EMAIL = env.to;
});

type Counter = { _id: string; key: string; attempts: number[] };
function fixture() {
  const rows: Counter[] = [];
  let now = 1_800_000_000_000;
  const ctx = {
    auth: { getUserIdentity: async () => null as { subject: string } | null },
    runQuery: async () => {
      throw new Error("Public requests must not look up accounts");
    },
    runMutation: async (_reference: unknown, args: unknown) =>
      call(reserveAccountHelpSend, args),
    db: {
      query(table: string) {
        assert.equal(table, "accountHelpThrottles");
        let key = "";
        return {
          withIndex(
            _index: string,
            build: (q: { eq: (field: string, value: string) => void }) => void,
          ) {
            build({
              eq: (_field, value) => {
                key = value;
              },
            });
            return {
              unique: async () => rows.find((row) => row.key === key) ?? null,
            };
          },
        };
      },
      insert: async (_table: string, value: Omit<Counter, "_id">) => {
        rows.push({ ...value, _id: String(rows.length) });
      },
      patch: async (id: string, patch: Partial<Counter>) => {
        Object.assign(rows.find((row) => row._id === id)!, patch);
      },
    },
  };
  async function call(fn: unknown, args: unknown) {
    const original = Date.now;
    Date.now = () => now;
    try {
      return await (
        fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> }
      )._handler(ctx, args);
    } finally {
      Date.now = original;
    }
  }
  return {
    ctx,
    rows,
    call,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const request = {
  name: "Visitor",
  email: "visitor@example.com",
  flow: "signup",
};

describe("public account help backend", () => {
  it("sends to the fixed studio inbox with unverified details and no account lookup", async () => {
    transport.reset();
    const f = fixture();
    assert.deepEqual(
      await f.call(sendAccountHelp, {
        ...request,
        email: " Visitor@EXAMPLE.com ",
        phone: "555-1234",
      }),
      { sent: true },
    );
    const message = transport.messages[0];
    assert.deepEqual(message.to, ["studio@example.com"]);
    assert.equal(message.replyTo, "visitor@example.com");
    assert.match(message.text, /UNVERIFIED/);
    assert.match(message.text, /555-1234/);
    assert.match(message.text, /Account registration/);
    assert.match(message.text, /No additional message/);
    assert.equal(f.rows.length, 2);
    assert.ok(f.rows.some((row) => /^email:[a-f0-9]{64}$/.test(row.key)));
    assert.equal(JSON.stringify(f.rows).includes("visitor@example.com"), false);
  });
  it("discards honeypot submissions without delivery or quota reservation", async () => {
    transport.reset();
    const f = fixture();
    await f.call(sendAccountHelp, { ...request, website: "spam" });
    assert.equal(transport.messages.length, 0);
    assert.equal(f.rows.length, 0);
  });
  it("validates on the server before reserving quota", async () => {
    transport.reset();
    const f = fixture();
    await assert.rejects(
      () => f.call(sendAccountHelp, { ...request, email: "bad" }),
      /valid email/,
    );
    assert.equal(transport.messages.length, 0);
    assert.equal(f.rows.length, 0);
  });
  it("reserves both limits before external delivery and counts failed sends", async () => {
    transport.reset(true);
    const f = fixture();
    await assert.rejects(
      () => f.call(sendAccountHelp, request),
      /couldn’t send/,
    );
    transport.reset();
    await assert.rejects(
      () =>
        f.call(sendAccountHelp, { ...request, email: " VISITOR@EXAMPLE.COM " }),
      /wait a minute/,
    );
    assert.equal(transport.messages.length, 0);
    f.advance(60_000);
    await f.call(sendAccountHelp, request);
    assert.ok(f.rows.every((row) => row.attempts.length === 2));
  });
  it("blocks the sixth email attempt and the thirty-first global attempt", async () => {
    transport.reset();
    const f = fixture();
    for (let i = 0; i < 5; i++) {
      await f.call(sendAccountHelp, request);
      f.advance(60_000);
    }
    await assert.rejects(() => f.call(sendAccountHelp, request), /too many/);
    for (let i = 0; i < 25; i++)
      await f.call(sendAccountHelp, {
        ...request,
        email: `visitor${i}@example.com`,
      });
    await assert.rejects(
      () => f.call(sendAccountHelp, { ...request, email: "last@example.com" }),
      /too many/,
    );
    assert.equal(transport.messages.length, 30);
  });
  it("keeps the existing contact endpoint authentication requirement", async () => {
    transport.reset();
    const f = fixture();
    await assert.rejects(
      () =>
        f.call(sendContactMessage, {
          subject: "Help",
          topic: "account_access",
          message: "Message",
        }),
      /Not authenticated/,
    );
    assert.equal(transport.messages.length, 0);
  });
});
