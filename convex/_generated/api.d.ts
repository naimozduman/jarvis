/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as health from '../health.js';
import type * as http from '../http.js';
import type * as jobs from '../jobs.js';
import type * as scheduler from '../scheduler.js';
import type * as scheduler_policy from '../scheduler_policy.js';
import type * as secret_comparison from '../secret_comparison.js';
import type * as transportSignals from '../transportSignals.js';

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';

declare const fullApi: ApiFromModules<{
  health: typeof health;
  http: typeof http;
  jobs: typeof jobs;
  scheduler: typeof scheduler;
  scheduler_policy: typeof scheduler_policy;
  secret_comparison: typeof secret_comparison;
  transportSignals: typeof transportSignals;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;

export declare const components: {};
