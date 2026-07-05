/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTPEmailVerification from "../ResendOTPEmailVerification.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as billingDispatch from "../billingDispatch.js";
import type * as billingDispatchData from "../billingDispatchData.js";
import type * as bulletins from "../bulletins.js";
import type * as classes from "../classes.js";
import type * as crons from "../crons.js";
import type * as etcFunctions from "../etcFunctions.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as invitationActions from "../invitationActions.js";
import type * as invitations from "../invitations.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_age from "../lib/age.js";
import type * as lib_billing_householdTuition from "../lib/billing/householdTuition.js";
import type * as lib_billing_privatePricing from "../lib/billing/privatePricing.js";
import type * as lib_billing_runSourceComponents from "../lib/billing/runSourceComponents.js";
import type * as lib_billing_tuitionCalculation from "../lib/billing/tuitionCalculation.js";
import type * as lib_billing_weeklyClassHours from "../lib/billing/weeklyClassHours.js";
import type * as lib_classSorting from "../lib/classSorting.js";
import type * as lib_enrollmentValidation from "../lib/enrollmentValidation.js";
import type * as lib_householdBilling from "../lib/householdBilling.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_privateScheduling from "../lib/privateScheduling.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_scheduling from "../lib/scheduling.js";
import type * as lib_stripe from "../lib/stripe.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as payments from "../payments.js";
import type * as paymentsData from "../paymentsData.js";
import type * as privates from "../privates.js";
import type * as pushActions from "../pushActions.js";
import type * as pushData from "../pushData.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as random from "../random.js";
import type * as reports from "../reports.js";
import type * as resendConfig from "../resendConfig.js";
import type * as stripe from "../stripe.js";
import type * as stripeData from "../stripeData.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTPEmailVerification: typeof ResendOTPEmailVerification;
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  auth: typeof auth;
  billing: typeof billing;
  billingDispatch: typeof billingDispatch;
  billingDispatchData: typeof billingDispatchData;
  bulletins: typeof bulletins;
  classes: typeof classes;
  crons: typeof crons;
  etcFunctions: typeof etcFunctions;
  files: typeof files;
  http: typeof http;
  invitationActions: typeof invitationActions;
  invitations: typeof invitations;
  "lib/activityLog": typeof lib_activityLog;
  "lib/age": typeof lib_age;
  "lib/billing/householdTuition": typeof lib_billing_householdTuition;
  "lib/billing/privatePricing": typeof lib_billing_privatePricing;
  "lib/billing/runSourceComponents": typeof lib_billing_runSourceComponents;
  "lib/billing/tuitionCalculation": typeof lib_billing_tuitionCalculation;
  "lib/billing/weeklyClassHours": typeof lib_billing_weeklyClassHours;
  "lib/classSorting": typeof lib_classSorting;
  "lib/enrollmentValidation": typeof lib_enrollmentValidation;
  "lib/householdBilling": typeof lib_householdBilling;
  "lib/notifications": typeof lib_notifications;
  "lib/privateScheduling": typeof lib_privateScheduling;
  "lib/roles": typeof lib_roles;
  "lib/scheduling": typeof lib_scheduling;
  "lib/stripe": typeof lib_stripe;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  payments: typeof payments;
  paymentsData: typeof paymentsData;
  privates: typeof privates;
  pushActions: typeof pushActions;
  pushData: typeof pushData;
  pushSubscriptions: typeof pushSubscriptions;
  random: typeof random;
  reports: typeof reports;
  resendConfig: typeof resendConfig;
  stripe: typeof stripe;
  stripeData: typeof stripeData;
  tasks: typeof tasks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
