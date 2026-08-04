/**
 * Shared types, URL/serialization helpers, and webhook parsing for the Wati
 * adapter.
 *
 * Contains the transport contract the API classes depend on, small pure
 * utilities for building request paths and JSON bodies, and helpers for
 * normalizing inbound webhook events, extracting message content, and
 * redacting secrets from logs.
 *
 * @see https://docs.wati.io/reference/introduction
 */

import { ValidationError } from "@chat-adapter/shared";
import type { Author } from "chat";
import type {
  WatiApiPath,
  WatiConversationEvent,
  WatiMessageReceivedEvent,
  WatiOpaquePayload,
} from "./types";

/** BSUID pattern: two or more uppercase letters followed by a dot. */
const BSUID_PATTERN = /^[A-Z]{2,}\./i;
/** `Bearer ` prefix stripped from API credentials. */
const BEARER_PREFIX_PATTERN = /^Bearer\s+/i;
/** Wati API token shape (`wati_...`). */
const WATI_TOKEN_PATTERN = /wati_[A-Za-z0-9_-]+/g;
/** JWT-like token shape (starts with the base64 `eyJ` prefix). */
const JWT_PATTERN = /eyJ[A-Za-z0-9._-]+/g;
/** Email address shape. */
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Phone number shape (optional `+`, 6+ digits with separators). */
const PHONE_NUMBER_PATTERN = /\+?\d(?:[\s()-]*\d){5,}/g;
/** Phone number shape as a URL path segment. */
const PATH_PHONE_PATTERN = /\/\+?\d(?:[\s()-]*\d){5,}(?=\/|$)/g;
/** BSUID shape as a URL path segment. */
const PATH_BSUID_PATTERN = /\/[A-Z]{2,}\.[^/]+(?=\/|$)/gi;
/** Maximum length of a single WhatsApp text message in characters. */
const WATI_TEXT_LIMIT = 4096;

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
// URL & Serialization Helpers
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

/**
 * Split text into messages of at most `maxLength` characters.
 *
 * WhatsApp limits a single text message to 4096 characters, so longer content
 * must be sent as multiple messages. When a chunk would be cut mid-paragraph,
 * the split is moved back to the nearest paragraph or line break (when that
 * break falls within the first half of the chunk) to keep paragraphs intact.
 *
 * @param text - The text to split
 * @param maxLength - Maximum chunk length (default 4096)
 * @returns The text split into chunks, or `[]` when `text` is empty
 */
export function splitWatiMessage(
  text: string,
  maxLength = WATI_TEXT_LIMIT
): string[] {
  if (!text) {
    return [];
  }
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength);
    let index = candidate.lastIndexOf("\n\n");
    if (index < maxLength / 2) {
      index = candidate.lastIndexOf("\n");
    }
    if (index < maxLength / 2) {
      index = maxLength;
    }
    chunks.push(remaining.slice(0, index).trimEnd());
    remaining = remaining.slice(index).trimStart();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

// =============================================================================
// Webhook Parsing
// =============================================================================

/**
 * Normalize an unknown webhook payload into a list of message events.
 *
 * Accepts a single event object, an array of events, or a wrapper object with
 * an `events` array. Non-event values are filtered out.
 */
export function normalizeWebhookEvents(
  value: unknown
): WatiMessageReceivedEvent[] {
  if (Array.isArray(value)) {
    return value.filter(isWebhookEvent);
  }
  if (isWebhookEvent(value)) {
    return [value];
  }
  if (isRecord(value) && Array.isArray(value.events)) {
    return value.events.filter(isWebhookEvent);
  }
  return [];
}

/**
 * Narrow an unknown value to a {@link WatiMessageReceivedEvent}.
 *
 * A value is considered an event when it is a record with a string `id`.
 */
function isWebhookEvent(value: unknown): value is WatiMessageReceivedEvent {
  return isRecord(value) && typeof value.id === "string";
}

/**
 * Narrow an unknown value to a plain record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// =============================================================================
// Event Extraction
// =============================================================================

/**
 * Read the first non-empty string value from `payload` across the given keys.
 *
 * Numeric values are converted to strings. Useful for extracting the same
 * field under several possible names from an opaque Wati payload.
 */
export function opaqueString(
  payload: WatiOpaquePayload,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

/**
 * Read a non-empty string field from a webhook event.
 */
export function webhookString(
  event: WatiMessageReceivedEvent | WatiConversationEvent,
  key: string
): string | undefined {
  const value = event[key];
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Build the {@link Author} for an inbound (customer) message.
 *
 * Falls back to the contact's username or `waId` when the sender name is
 * missing.
 */
export function inboundAuthor(
  event: WatiMessageReceivedEvent,
  waId: string
): Author {
  const name = event.senderName ?? event.username ?? waId;
  return {
    userId: waId,
    userName: event.username ?? waId,
    fullName: name,
    isBot: false,
    isMe: false,
  };
}

/**
 * Extract human-readable text for a webhook event.
 *
 * Text events return their body; non-text types return a descriptive
 * placeholder such as `[Image]` or `[Location: lat, lng]`.
 */
export function extractText(
  event: WatiMessageReceivedEvent | WatiConversationEvent
): string {
  if (event.text) {
    return event.text;
  }
  switch (event.type) {
    case "image":
      return "[Image]";
    case "document":
      return "[Document]";
    case "audio":
      return "[Audio message]";
    case "voice":
      return "[Voice message]";
    case "video":
      return "[Video]";
    case "sticker":
      return "[Sticker]";
    case "location": {
      const data =
        "data" in event && isRecord(event.data) ? event.data : undefined;
      if (!data) {
        return "[Location]";
      }
      const latitude = opaqueString(data, "latitude", "lat");
      const longitude = opaqueString(data, "longitude", "lng", "lon");
      return latitude && longitude
        ? `[Location: ${latitude}, ${longitude}]`
        : "[Location]";
    }
    default:
      return "";
  }
}

/**
 * Resolve the send time of a webhook event.
 *
 * Prefers the `created` timestamp, then `timestamp` (handling both seconds
 * and milliseconds epoch values), and finally the current time.
 */
export function eventDate(
  event: WatiMessageReceivedEvent | WatiConversationEvent
): Date {
  if (event.created) {
    const created = new Date(event.created);
    if (!Number.isNaN(created.getTime())) {
      return created;
    }
  }
  if (event.timestamp) {
    const numeric = Number(event.timestamp);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000);
    }
    const timestamp = new Date(event.timestamp);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }
  return new Date();
}

// =============================================================================
// Parsing & Formatting
// =============================================================================

/**
 * Parse a pagination cursor into a 1-based page number.
 *
 * @throws {ValidationError} When `cursor` is not a positive integer.
 */
export function parsePageCursor(cursor?: string): number {
  if (!cursor) {
    return 1;
  }
  const page = Number.parseInt(cursor, 10);
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError("wati", `Invalid message cursor: ${cursor}`);
  }
  return page;
}

/**
 * Infer a MIME type from a file name's extension.
 *
 * Unknown extensions fall back to `application/octet-stream`.
 */
export function inferMimeType(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const mimeTypes: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    ogg: "audio/ogg",
    pdf: "application/pdf",
    png: "image/png",
    webp: "image/webp",
  };
  return mimeTypes[extension] ?? "application/octet-stream";
}

/**
 * Extract the webhook secret embedded in a URL path.
 *
 * Expects a `/webhook/<secret>` path segment; returns `null` when the path
 * has no `webhook` segment or the secret is the final segment.
 */
export function webhookPathSecret(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const webhookIndex = parts.lastIndexOf("webhook");
  if (webhookIndex === -1 || webhookIndex === parts.length - 1) {
    return null;
  }
  return decodeURIComponent(parts[webhookIndex + 1] ?? "");
}

/**
 * Check whether a value looks like a BSUID (e.g. `US.123124141512`).
 */
export function isBsuid(value: string): boolean {
  return BSUID_PATTERN.test(value);
}

/**
 * Narrow a string to a {@link WatiApiPath}.
 *
 * Only relative paths under `/api/v1/`, `/api/v2/`, or `/api/ext/v3/` are
 * accepted, which also prevents the bearer token from being forwarded to
 * another origin.
 */
export function isAllowedApiPath(path: string): path is WatiApiPath {
  return (
    path.startsWith("/api/v1/") ||
    path.startsWith("/api/v2/") ||
    path.startsWith("/api/ext/v3/")
  );
}

/**
 * Normalize a bearer credential by trimming whitespace and stripping a
 * leading `Bearer ` prefix.
 */
export function normalizeBearerCredential(value: string): string {
  return value.trim().replace(BEARER_PREFIX_PATTERN, "");
}

// =============================================================================
// Redaction
// =============================================================================

/**
 * Redact secrets from a Wati API error body.
 *
 * Replaces tokens, JWTs, emails, and phone numbers with placeholders and caps
 * the body at 1000 characters so credentials never reach logs.
 */
export function redactWatiErrorBody(body: string): string {
  return body
    .slice(0, 1000)
    .replace(WATI_TOKEN_PATTERN, "[redacted-token]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_NUMBER_PATTERN, "[redacted-number]");
}

/**
 * Redact secrets from a Wati API path for logging.
 *
 * Strips the query string and replaces phone numbers and BSUIDs embedded in
 * path segments with placeholders.
 */
export function redactWatiApiPath(path: string): string {
  const pathname = path.split("?", 1)[0];
  return pathname
    .replace(PATH_PHONE_PATTERN, "/[redacted-number]")
    .replace(PATH_BSUID_PATTERN, "/[redacted-bsuid]");
}
