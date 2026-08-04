/**
 * Shared types and URL/serialization helpers for the Wati adapter.
 *
 * Contains the transport contract the API classes depend on, plus small pure
 * utilities for building request paths, query strings, and JSON bodies.
 *
 * @see https://docs.wati.io/reference/introduction
 */

import type { WatiApiPath } from "./types";

// =============================================================================
// Transport
// =============================================================================

/**
 * Low-level transport used by the API namespaces.
 *
 * Implementations own the base URL, Bearer token header, and response
 * handling. `json` parses the response body as JSON, `raw` returns the
 * unparsed {@link Response} (for binary media downloads).
 */
export interface WatiApiTransport {
  /** Perform a request and parse the response body as JSON. */
  json<T>(path: WatiApiPath, init?: RequestInit): Promise<T>;
  /** Perform a request and return the raw response. */
  raw(path: WatiApiPath, init?: RequestInit): Promise<Response>;
}

/**
 * Target selector for legacy V1/V2 endpoints.
 *
 * Exactly one of `target` (polymorphic: phone number, contact ID, or BSUID)
 * or `whatsappNumber` must be provided.
 *
 * @see https://docs.wati.io/reference/bsuid-target-format
 */
export type WatiLegacyTarget =
  | { target: string; whatsappNumber?: never }
  | { target?: never; whatsappNumber: string };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Append a query string to a Wati API path.
 *
 * Skips `null`, `undefined`, and empty-string values so callers can pass
 * optional query parameters directly.
 */
export function appendQuery(
  path: string,
  values: Record<string, boolean | number | string | null | undefined>
): WatiApiPath {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return `${path}${serialized ? `?${serialized}` : ""}` as WatiApiPath;
}

/**
 * Resolve a {@link WatiLegacyTarget} into the query parameters expected by
 * the legacy V1/V2 endpoints.
 */
export function targetQuery(target: WatiLegacyTarget): Record<string, string> {
  return "target" in target && typeof target.target === "string"
    ? { target: target.target }
    : { whatsappNumber: target.whatsappNumber as string };
}

/**
 * Build a JSON request initializer.
 *
 * When `body` is provided it is serialized as JSON with the given `method`;
 * otherwise the method is set with no body.
 */
export function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

/**
 * Percent-encode a single path segment for safe interpolation into a Wati API
 * path.
 */
export function encodePath(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Serialize a date-like value to an ISO 8601 string accepted by the Wati API.
 *
 * Returns `Date` instances via `toISOString()` and passes strings through
 * unchanged.
 */
export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
