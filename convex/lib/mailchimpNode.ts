"use node";

import { createHash } from "node:crypto";
import { normalizeMailchimpEmail } from "./mailchimp.ts";

export function mailchimpSubscriberHash(email: string) {
  return createHash("md5")
    .update(normalizeMailchimpEmail(email) || email.trim().toLowerCase())
    .digest("hex");
}

export function mailchimpMemberUrl({
  serverPrefix,
  audienceId,
  email,
}: {
  serverPrefix: string;
  audienceId: string;
  email: string;
}) {
  return `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${encodeURIComponent(audienceId)}/members/${mailchimpSubscriberHash(email)}`;
}
