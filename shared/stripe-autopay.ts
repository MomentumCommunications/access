import type Stripe from "stripe";

export class AutopaySyncError extends Error {}
export class AutopaySupersededError extends Error {}
export const AUTOPAY_DEFAULT_DUE_DAYS = 14;
export type PaymentTerms = Record<string, number>;
export function stripeId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  return undefined;
}

function terms(
  key: string,
  current: number | null | undefined,
  saved: PaymentTerms,
  fallback = AUTOPAY_DEFAULT_DUE_DAYS,
) {
  if (current != null) saved[key] = current;
  return saved[key] ?? fallback;
}

function assertSupportedFields(
  value: object | null | undefined,
  keys: readonly string[],
  path = "phase",
) {
  if (!value) return;
  for (const [key, field] of Object.entries(value)) {
    if (field != null && !keys.includes(key)) {
      throw new AutopaySyncError(
        `An unsupported schedule setting (${path}.${key}) needs manual review in Stripe.`,
      );
    }
  }
}

function discounts(values: Stripe.SubscriptionSchedule.Phase.Discount[]) {
  return values.map((value) => {
    assertSupportedFields(
      value,
      ["discount", "promotion_code", "coupon"],
      "discount",
    );
    if (value.discount) return { discount: stripeId(value.discount)! };
    if (value.promotion_code)
      return { promotion_code: stripeId(value.promotion_code)! };
    if (value.coupon) return { coupon: stripeId(value.coupon)! };
    throw new AutopaySyncError(
      "A schedule discount needs manual review in Stripe.",
    );
  });
}

// Stripe returns Dashboard-configured footers although the installed SDK omits
// this field from its schedule invoice-settings types. Preserve the wire value.
type ScheduleInvoiceSettings =
  Stripe.SubscriptionSchedule.Phase.InvoiceSettings & {
    footer?: string | null;
  };

function invoiceSettings(value: ScheduleInvoiceSettings | null) {
  assertSupportedFields(
    value,
    ["account_tax_ids", "days_until_due", "issuer", "footer"],
    "invoice_settings",
  );
  assertSupportedFields(
    value?.issuer,
    ["type", "account"],
    "invoice_settings.issuer",
  );
  return {
    ...(value?.footer != null ? { footer: value.footer } : {}),
    ...(value?.account_tax_ids
      ? { account_tax_ids: value.account_tax_ids.map((id) => stripeId(id)!) }
      : {}),
    ...(value?.issuer
      ? {
          issuer: {
            type: value.issuer.type,
            ...(value.issuer.account
              ? { account: stripeId(value.issuer.account) }
              : {}),
          },
        }
      : {}),
  };
}

// Explicit response -> request conversion. Never pass expanded Stripe objects or
// silently discard a newly introduced phase setting when replacing phases.
export function preservePhase(
  phase: Stripe.SubscriptionSchedule.Phase,
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  const known = new Set([
    "add_invoice_items",
    "application_fee_percent",
    "automatic_tax",
    "billing_cycle_anchor",
    "billing_thresholds",
    "collection_method",
    "currency",
    "default_payment_method",
    "default_tax_rates",
    "description",
    "discounts",
    "end_date",
    "invoice_settings",
    "items",
    "metadata",
    "on_behalf_of",
    "proration_behavior",
    "start_date",
    "transfer_data",
    "trial_end",
  ]);
  assertSupportedFields(phase, [...known]);
  assertSupportedFields(phase.automatic_tax, [
    "enabled",
    "disabled_reason",
    "liability",
  ]);
  assertSupportedFields(phase.automatic_tax?.liability, ["type", "account"]);
  assertSupportedFields(phase.billing_thresholds, [
    "amount_gte",
    "reset_billing_cycle_anchor",
  ]);
  assertSupportedFields(phase.transfer_data, ["destination", "amount_percent"]);
  for (const item of phase.items) {
    assertSupportedFields(item, [
      "price",
      "plan",
      "quantity",
      "billing_thresholds",
      "discounts",
      "metadata",
      "tax_rates",
    ]);
    assertSupportedFields(item.billing_thresholds, ["usage_gte"]);
  }
  // Replaying one-off phase charges is outside collection-method synchronization.
  if (phase.add_invoice_items?.length)
    throw new AutopaySyncError(
      "A schedule with additional invoice items needs manual review in Stripe.",
    );
  return {
    start_date: phase.start_date,
    end_date: phase.end_date,
    items: phase.items.map((item) => ({
      price: stripeId(item.price)!,
      ...(item.quantity != null ? { quantity: item.quantity } : {}),
      ...(item.billing_thresholds?.usage_gte != null
        ? {
            billing_thresholds: {
              usage_gte: item.billing_thresholds.usage_gte,
            },
          }
        : {}),
      discounts: discounts(item.discounts),
      ...(item.metadata ? { metadata: item.metadata } : {}),
      ...(item.tax_rates
        ? { tax_rates: item.tax_rates.map((tax) => stripeId(tax)!) }
        : {}),
    })),
    discounts: discounts(phase.discounts),
    proration_behavior: phase.proration_behavior,
    currency: phase.currency,
    ...(phase.application_fee_percent != null
      ? { application_fee_percent: phase.application_fee_percent }
      : {}),
    ...(phase.automatic_tax
      ? {
          automatic_tax: {
            enabled: phase.automatic_tax.enabled,
            ...(phase.automatic_tax.liability
              ? {
                  liability: {
                    type: phase.automatic_tax.liability.type,
                    ...(phase.automatic_tax.liability.account
                      ? {
                          account: stripeId(
                            phase.automatic_tax.liability.account,
                          ),
                        }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(phase.billing_cycle_anchor
      ? { billing_cycle_anchor: phase.billing_cycle_anchor }
      : {}),
    ...(phase.billing_thresholds
      ? {
          billing_thresholds: {
            ...(phase.billing_thresholds.amount_gte != null
              ? { amount_gte: phase.billing_thresholds.amount_gte }
              : {}),
            ...(phase.billing_thresholds.reset_billing_cycle_anchor != null
              ? {
                  reset_billing_cycle_anchor:
                    phase.billing_thresholds.reset_billing_cycle_anchor,
                }
              : {}),
          },
        }
      : {}),
    ...(phase.default_payment_method
      ? { default_payment_method: stripeId(phase.default_payment_method) }
      : {}),
    ...(phase.default_tax_rates
      ? {
          default_tax_rates: phase.default_tax_rates.map(
            (tax) => stripeId(tax)!,
          ),
        }
      : {}),
    ...(phase.description != null ? { description: phase.description } : {}),
    ...(phase.metadata ? { metadata: phase.metadata } : {}),
    ...(phase.on_behalf_of
      ? { on_behalf_of: stripeId(phase.on_behalf_of) }
      : {}),
    ...(phase.transfer_data
      ? {
          transfer_data: {
            destination: stripeId(phase.transfer_data.destination)!,
            ...(phase.transfer_data.amount_percent != null
              ? { amount_percent: phase.transfer_data.amount_percent }
              : {}),
          },
        }
      : {}),
    ...(phase.trial_end != null ? { trial_end: phase.trial_end } : {}),
    ...(phase.invoice_settings
      ? { invoice_settings: invoiceSettings(phase.invoice_settings) }
      : {}),
  };
}

export async function synchronizeStripeAutopay({
  stripe,
  customerId,
  enabled,
  savedTerms,
  checkpoint,
  requestKey,
}: {
  stripe: Pick<
    Stripe,
    "customers" | "subscriptions" | "subscriptionSchedules" | "paymentMethods"
  >;
  customerId: string;
  enabled: boolean;
  savedTerms: PaymentTerms;
  checkpoint: (saved: PaymentTerms) => Promise<void>;
  requestKey: (objectId: string, payload: unknown) => string;
}) {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted)
    throw new AutopaySyncError("The linked Stripe customer was deleted.");
  const customerMethod = customer.invoice_settings.default_payment_method;
  const customerSource = customer.default_source;
  const methodCache = new Map<string, boolean>();
  async function usable(
    method: string | { id: string } | null | undefined,
    source?: string | { id: string } | null,
  ) {
    const id = stripeId(method);
    if (!id) return Boolean(stripeId(source));
    if (!methodCache.has(id)) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(id);
        methodCache.set(id, stripeId(paymentMethod.customer) === customerId);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode !== 404) throw error;
        methodCache.set(id, false);
      }
    }
    return methodCache.get(id)!;
  }
  async function effectiveMethod(method: unknown, source?: unknown) {
    if (stripeId(method)) return usable(stripeId(method));
    if (stripeId(source)) return true;
    return usable(customerMethod, customerSource);
  }
  const subscriptions: Stripe.Subscription[] = [];
  for await (const sub of stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  }))
    subscriptions.push(sub);
  const schedules = new Map<string, Stripe.SubscriptionSchedule>();
  for await (const schedule of stripe.subscriptionSchedules.list({
    customer: customerId,
    limit: 100,
  })) {
    if (schedule.status === "active" || schedule.status === "not_started")
      schedules.set(schedule.id, schedule);
  }
  const problems: string[] = [];
  for (const sub of subscriptions) {
    if (["canceled", "incomplete_expired"].includes(sub.status)) continue;
    if (["incomplete", "paused"].includes(sub.status)) {
      problems.push(
        "A subscription is incomplete or paused and needs review in Stripe.",
      );
      const scheduleId = stripeId(sub.schedule);
      if (scheduleId) schedules.delete(scheduleId);
      continue;
    }
    if (sub.schedule) {
      if (!schedules.has(stripeId(sub.schedule)!))
        problems.push(
          "A subscription schedule changed during synchronization. Retry synchronization.",
        );
      continue;
    }
    const days = terms(sub.id, sub.days_until_due, savedTerms);
    const automatic =
      enabled &&
      (await effectiveMethod(sub.default_payment_method, sub.default_source));
    const collection_method = automatic
      ? "charge_automatically"
      : "send_invoice";
    await checkpoint(savedTerms);
    if (
      sub.collection_method === collection_method &&
      (automatic || sub.days_until_due === days)
    )
      continue;
    const payload: Stripe.SubscriptionUpdateParams = {
      collection_method,
      ...(automatic ? {} : { days_until_due: days }),
    };
    await stripe.subscriptions.update(sub.id, payload, {
      idempotencyKey: requestKey(sub.id, payload),
    });
  }
  for (const schedule of schedules.values()) {
    try {
      const defaults = schedule.default_settings;
      const defaultDays = terms(
        `${schedule.id}:default`,
        defaults.invoice_settings.days_until_due,
        savedTerms,
      );
      const defaultSource = (
        defaults as typeof defaults & { default_source?: string | null }
      ).default_source;
      const automatic =
        enabled &&
        (await effectiveMethod(defaults.default_payment_method, defaultSource));
      const defaultMethod = automatic ? "charge_automatically" : "send_invoice";
      let changed =
        defaults.collection_method !== defaultMethod ||
        (!automatic &&
          defaults.invoice_settings.days_until_due !== defaultDays);
      const phases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [];
      for (const phase of schedule.phases.filter(
        (p) =>
          !schedule.current_phase ||
          p.start_date >= schedule.current_phase.start_date,
      )) {
        const phaseKey = `${schedule.id}:${phase.start_date}`;
        // Persist inherited terms too, before Stripe clears days_until_due on auto-charge.
        const oldMethod = phase.collection_method || defaults.collection_method;
        const days = terms(
          phaseKey,
          phase.invoice_settings?.days_until_due ??
            (oldMethod === "send_invoice"
              ? defaults.invoice_settings.days_until_due
              : undefined),
          savedTerms,
          defaultDays,
        );
        const phaseAutomatic =
          enabled &&
          (await effectiveMethod(
            phase.default_payment_method || defaults.default_payment_method,
            defaultSource,
          ));
        const collection_method = phaseAutomatic
          ? "charge_automatically"
          : "send_invoice";
        changed ||=
          oldMethod !== collection_method ||
          (!phaseAutomatic &&
            (phase.invoice_settings?.days_until_due ??
              defaults.invoice_settings.days_until_due) !== days);
        phases.push({
          ...preservePhase(phase),
          collection_method,
          invoice_settings: {
            ...invoiceSettings(phase.invoice_settings),
            ...(!phaseAutomatic ? { days_until_due: days } : {}),
          },
        });
      }
      await checkpoint(savedTerms);
      if (!changed) continue;
      const payload: Stripe.SubscriptionScheduleUpdateParams = {
        default_settings: {
          collection_method: defaultMethod,
          invoice_settings: {
            ...invoiceSettings(defaults.invoice_settings),
            ...(!automatic ? { days_until_due: defaultDays } : {}),
          },
        },
        phases,
        proration_behavior: "none",
      };
      await stripe.subscriptionSchedules.update(schedule.id, payload, {
        idempotencyKey: requestKey(schedule.id, payload),
      });
    } catch (error) {
      if (!(error instanceof AutopaySyncError)) throw error;
      problems.push(error.message);
    }
  }
  await checkpoint(savedTerms);
  if (problems.length)
    throw new AutopaySyncError([...new Set(problems)].join(" "));
}

export function autopayFailure(error: unknown) {
  if (error instanceof AutopaySyncError)
    return { message: error.message, retryable: false };
  const status = (error as { statusCode?: number })?.statusCode;
  const type = (error as { type?: string })?.type;
  const retryable =
    !status || status === 409 || status === 429 || status >= 500;
  return {
    retryable,
    message:
      type === "StripeAuthenticationError"
        ? "Stripe credentials need administrator attention."
        : retryable
          ? "Stripe could not be reached. Synchronization will retry."
          : "Stripe rejected a subscription update. Review its settings and retry.",
  };
}

export function webhookCustomer(event: Stripe.Event): string | undefined {
  const object = event.data.object as unknown as {
    id: string;
    customer?: string | { id: string } | null;
  };
  if (
    ["customer.created", "customer.updated", "customer.deleted"].includes(
      event.type,
    )
  )
    return object.id;
  if (
    event.type.startsWith("customer.subscription.") ||
    event.type.startsWith("subscription_schedule.") ||
    event.type.startsWith("payment_method.") ||
    event.type.startsWith("customer.source.")
  ) {
    return (
      stripeId(object.customer) ||
      stripeId(
        (event.data.previous_attributes as { customer?: string } | undefined)
          ?.customer,
      )
    );
  }
  return undefined;
}
