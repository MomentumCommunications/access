"use node";

import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripeClient() {
  if (stripeClient) return stripeClient;
  const apiKey =
    process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY or STRIPE_API_KEY.",
    );
  }
  stripeClient = new Stripe(apiKey);
  return stripeClient;
}
