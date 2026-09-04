import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRetryableMailchimpFailure,
  mailchimpMemberPayload,
  mailchimpRetryDelay,
  mailchimpServerPrefix,
  normalizeMailchimpEmail,
  selectMailchimpClient,
} from "../convex/lib/mailchimp.ts";
import {
  mailchimpMemberUrl,
  mailchimpSubscriberHash,
} from "../convex/lib/mailchimpNode.ts";

describe("Mailchimp completed-client sync", () => {
  it("selects completed clients regardless of onboarding source", () => {
    assert.deepEqual(
      selectMailchimpClient({
        email: " Client@Example.com ",
        firstName: " Olivia ",
        lastName: " Hillard ",
        onboardingStatus: "complete",
        roles: ["member"],
      }),
      {
        email: "client@example.com",
        firstName: "Olivia",
        lastName: "Hillard",
      },
    );
  });

  it("skips incomplete, workforce, and invalid-email accounts", () => {
    const base = {
      email: "client@example.com",
      onboardingStatus: "complete" as const,
    };
    assert.equal(selectMailchimpClient({ ...base, roles: ["staff"] }), null);
    assert.equal(selectMailchimpClient({ ...base, roles: ["admin"] }), null);
    assert.equal(
      selectMailchimpClient({
        ...base,
        onboardingStatus: "pending",
        roles: ["member"],
      }),
      null,
    );
    assert.equal(
      selectMailchimpClient({ ...base, email: "invalid", roles: ["member"] }),
      null,
    );
    assert.equal(
      selectMailchimpClient({ email: undefined, roles: ["member"] }),
      null,
    );
  });

  it("normalizes and hashes the primary email deterministically", () => {
    assert.equal(normalizeMailchimpEmail(" Client@Example.com "), "client@example.com");
    assert.equal(
      mailchimpSubscriberHash(" Client@Example.com "),
      mailchimpSubscriberHash("client@example.com"),
    );
    assert.match(mailchimpSubscriberHash("client@example.com"), /^[a-f0-9]{32}$/);
  });

  it("builds the member URL and subscribed new-member payload", () => {
    const member = {
      email: "client@example.com",
      firstName: "Olivia",
      lastName: "Hillard",
    };
    assert.equal(
      mailchimpMemberUrl({
        serverPrefix: "us21",
        audienceId: "audience/id",
        email: member.email,
      }),
      `https://us21.api.mailchimp.com/3.0/lists/audience%2Fid/members/${mailchimpSubscriberHash(member.email)}`,
    );
    const payload = mailchimpMemberPayload(member);
    assert.deepEqual(payload, {
      email_address: "client@example.com",
      status_if_new: "subscribed",
      merge_fields: { FNAME: "Olivia", LNAME: "Hillard" },
    });
    assert.equal("status" in payload, false);
    assert.equal("tags" in payload, false);
  });

  it("extracts valid server prefixes from API keys", () => {
    assert.equal(mailchimpServerPrefix("secret-us21"), "us21");
    assert.equal(mailchimpServerPrefix("secret-US6"), "us6");
    assert.equal(mailchimpServerPrefix("secret"), null);
  });

  it("retries transient failures three times", () => {
    assert.equal(isRetryableMailchimpFailure(undefined), true);
    assert.equal(isRetryableMailchimpFailure(429), true);
    assert.equal(isRetryableMailchimpFailure(500), true);
    assert.equal(isRetryableMailchimpFailure(400), false);
    assert.equal(mailchimpRetryDelay(0), 60_000);
    assert.equal(mailchimpRetryDelay(1), 300_000);
    assert.equal(mailchimpRetryDelay(2), 1_800_000);
    assert.equal(mailchimpRetryDelay(3), undefined);
  });
});
