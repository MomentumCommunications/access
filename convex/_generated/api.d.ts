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
import type * as bulletins from "../bulletins.js";
import type * as classes from "../classes.js";
import type * as etcFunctions from "../etcFunctions.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_age from "../lib/age.js";
import type * as lib_classSorting from "../lib/classSorting.js";
import type * as lib_privateScheduling from "../lib/privateScheduling.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_scheduling from "../lib/scheduling.js";
import type * as onboarding from "../onboarding.js";
import type * as privates from "../privates.js";
import type * as random from "../random.js";
import type * as resendConfig from "../resendConfig.js";
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
  bulletins: typeof bulletins;
  classes: typeof classes;
  etcFunctions: typeof etcFunctions;
  files: typeof files;
  http: typeof http;
  "lib/age": typeof lib_age;
  "lib/classSorting": typeof lib_classSorting;
  "lib/privateScheduling": typeof lib_privateScheduling;
  "lib/roles": typeof lib_roles;
  "lib/scheduling": typeof lib_scheduling;
  onboarding: typeof onboarding;
  privates: typeof privates;
  random: typeof random;
  resendConfig: typeof resendConfig;
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
