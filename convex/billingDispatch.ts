"use node";

import { v } from "convex/values";
import type Stripe from "stripe";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getStripeClient } from "./lib/stripe";
import {
  dispatchBillingRunItemToStripe,
  type PaymentMethodReadiness,
  type StripeCollectionMethod,
} from "../shared/stripe-invoice-dispatch";

function stripeFailureMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Stripe draft invoice dispatch failed.";
}

async function getPaymentMethodReadiness(
  stripe: Stripe,
  stripeCustomerId: string,
): Promise<PaymentMethodReadiness> {
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) {
      return {
        status: "lookup_failed",
        reason: "The Stripe customer has been deleted.",
      };
    }
    return {
      status: "ready",
      hasUsableDefaultPaymentMethod: Boolean(
        customer.invoice_settings.default_payment_method ||
          customer.default_source,
      ),
    };
  } catch (error) {
    return {
      status: "lookup_failed",
      reason: `Stripe payment-method readiness lookup failed: ${stripeFailureMessage(error)}`,
    };
  }
}

export const adminDispatchBillingRunItems = action({
  args: {
    billingRunId: v.id("billingRuns"),
    billingRunItemIds: v.array(v.id("billingRunItems")),
  },
  handler: async (ctx, { billingRunId, billingRunItemIds }) => {
    const uniqueItemIds = [...new Set(billingRunItemIds)];
    if (uniqueItemIds.length === 0) {
      throw new Error("Select at least one household to dispatch.");
    }

    const results = [];
    for (const billingRunItemId of uniqueItemIds) {
      let stripeInvoiceId: string | undefined;
      let stripeCustomerId: string | undefined;
      let collectionMethod: StripeCollectionMethod | undefined;
      let autopayEnabled: boolean | undefined;
      try {
        const prepared = await ctx.runQuery(
          internal.billingDispatchData.prepareBillingRunItemDispatch,
          { billingRunId, billingRunItemId },
        );
        if (prepared.status === "already_dispatched") {
          results.push({
            billingRunItemId,
            status: "already_dispatched" as const,
            stripeInvoiceId: prepared.stripeInvoiceId,
          });
          continue;
        }
        if (prepared.target.status !== "ready") {
          throw new Error(prepared.target.reason);
        }
        stripeCustomerId = prepared.target.stripeCustomerId;
        autopayEnabled = prepared.target.autopayEnabled;
        stripeInvoiceId = prepared.item.existingStripeInvoiceId;
        const stripe = getStripeClient();
        const readiness = autopayEnabled
          ? await getPaymentMethodReadiness(stripe, stripeCustomerId)
          : undefined;
        const dispatched = await dispatchBillingRunItemToStripe({
          item: prepared.item,
          target: prepared.target,
          readiness,
          existingStripeInvoiceId: stripeInvoiceId,
          createInvoice: async (input) => {
            return await stripe.invoices.create(
              {
                customer: input.customer,
                collection_method: input.collectionMethod,
                auto_advance: true,
                description: input.description,
                metadata: input.metadata,
                ...(input.collectionMethod === "send_invoice"
                  ? { days_until_due: 30 }
                  : {}),
              },
              { idempotencyKey: input.idempotencyKey },
            );
          },
          retrieveInvoice: async (invoiceId) =>
            await stripe.invoices.retrieve(invoiceId),
          createInvoiceLine: async (input) => {
            const start = Math.floor(
              new Date(`${input.periodStart}T00:00:00Z`).getTime() / 1000,
            );
            const end = Math.floor(
              new Date(`${input.periodEnd}T23:59:59Z`).getTime() / 1000,
            );
            await stripe.invoiceItems.create(
              {
                customer: input.customer,
                invoice: input.invoiceId,
                amount: input.line.amountCents,
                currency: "usd",
                description: input.line.description,
                metadata: input.line.metadata,
                period: { start, end },
              },
              { idempotencyKey: input.idempotencyKey },
            );
          },
          onInvoiceResolved: (resolved) => {
            stripeInvoiceId = resolved.stripeInvoiceId;
            collectionMethod = resolved.collectionMethod;
          },
        });
        await ctx.runMutation(
          internal.billingDispatchData.markBillingRunItemDispatched,
          {
            billingRunId,
            billingRunItemId,
            stripeInvoiceId: dispatched.stripeInvoiceId,
            stripeCustomerId: dispatched.stripeCustomerId,
            collectionMethod: dispatched.collectionMethod,
            autopayEnabled: dispatched.autopayEnabled,
            adjustmentTotalCents: prepared.item.adjustmentTotalCents,
            finalTotalCents: prepared.item.finalTotalCents,
            tuitionSubtotalCents: prepared.item.tuitionSubtotalCents,
            chargesSubtotalCents: prepared.item.chargesSubtotalCents,
            sourceAdjustments: prepared.item.sourceAdjustments,
          },
        );
        results.push({
          billingRunItemId,
          status: "dispatched" as const,
          stripeInvoiceId: dispatched.stripeInvoiceId,
        });
      } catch (error) {
        const reason = stripeFailureMessage(error);
        await ctx.runMutation(
          internal.billingDispatchData.markBillingRunItemDispatchFailed,
          {
            billingRunId,
            billingRunItemId,
            reason,
            stripeInvoiceId,
            stripeCustomerId,
            collectionMethod,
            autopayEnabled,
          },
        );
        results.push({
          billingRunItemId,
          status: "dispatch_failed" as const,
          reason,
          stripeInvoiceId,
        });
      }
    }

    return {
      dispatchedCount: results.filter(
        (result) => result.status === "dispatched",
      ).length,
      failedCount: results.filter(
        (result) => result.status === "dispatch_failed",
      ).length,
      alreadyDispatchedCount: results.filter(
        (result) => result.status === "already_dispatched",
      ).length,
      results,
    };
  },
});
