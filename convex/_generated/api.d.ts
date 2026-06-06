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
import type * as channels from "../channels.js";
import type * as classes from "../classes.js";
import type * as etcFunctions from "../etcFunctions.js";
import type * as http from "../http.js";
import type * as lib_classSorting from "../lib/classSorting.js";
import type * as messages from "../messages.js";
import type * as random from "../random.js";
import type * as reactions from "../reactions.js";
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
  channels: typeof channels;
  classes: typeof classes;
  etcFunctions: typeof etcFunctions;
  http: typeof http;
  "lib/classSorting": typeof lib_classSorting;
  messages: typeof messages;
  random: typeof random;
  reactions: typeof reactions;
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
