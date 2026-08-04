import { describe, expect, it } from "vitest";
import {
  appendQuery,
  encodePath,
  eventDate,
  extractText,
  inboundAuthor,
  inferMimeType,
  isAllowedApiPath,
  isBsuid,
  isRecord,
  jsonRequest,
  normalizeBearerCredential,
  normalizeWebhookEvents,
  opaqueString,
  parsePageCursor,
  redactWatiApiPath,
  redactWatiErrorBody,
  splitWatiMessage,
  targetQuery,
  toIso,
  webhookPathSecret,
  webhookString,
} from "./shared";

describe("appendQuery", () => {
  it("skips null, undefined, and empty values", () => {
    expect(
      appendQuery("/api/v1/getContacts", {
        pageSize: 10,
        name: "",
        x: null,
        y: undefined,
      })
    ).toBe("/api/v1/getContacts?pageSize=10");
  });

  it("returns the path unchanged when no values remain", () => {
    expect(appendQuery("/api/v1/getContacts", { a: undefined })).toBe(
      "/api/v1/getContacts"
    );
  });
});

describe("targetQuery", () => {
  it("maps a target selector", () => {
    expect(targetQuery({ target: "US.123" })).toEqual({ target: "US.123" });
  });

  it("maps a whatsappNumber selector", () => {
    expect(targetQuery({ whatsappNumber: "14155552671" })).toEqual({
      whatsappNumber: "14155552671",
    });
  });
});

describe("jsonRequest", () => {
  it("serializes a body as JSON", () => {
    expect(jsonRequest("POST", { a: 1 })).toEqual({
      method: "POST",
      body: '{"a":1}',
    });
  });

  it("omits the body when undefined", () => {
    expect(jsonRequest("GET")).toEqual({ method: "GET" });
  });
});

describe("encodePath", () => {
  it("percent-encodes path segments", () => {
    expect(encodePath("a/b c")).toBe("a%2Fb%20c");
  });
});

describe("toIso", () => {
  it("serializes Date instances", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    expect(toIso(date)).toBe("2024-01-15T10:30:00.000Z");
  });

  it("passes strings through", () => {
    expect(toIso("2024-01-15T10:30:00Z")).toBe("2024-01-15T10:30:00Z");
  });
});

describe("splitWatiMessage", () => {
  it("returns an empty array for empty text", () => {
    expect(splitWatiMessage("")).toEqual([]);
  });

  it("returns the text as-is when within the limit", () => {
    expect(splitWatiMessage("hello")).toEqual(["hello"]);
  });

  it("splits long text into chunks at the limit", () => {
    const chunks = splitWatiMessage("a".repeat(10), 4);
    expect(chunks).toEqual(["aaaa", "aaaa", "aa"]);
  });

  it("prefers paragraph breaks over hard cuts", () => {
    const text = `${"a".repeat(50)}\n\n${"b".repeat(50)}`;
    const chunks = splitWatiMessage(text, 60);
    expect(chunks).toHaveLength(1 + 1);
    expect(chunks[0].endsWith("aa")).toBe(true);
    expect(chunks[1].startsWith("bb")).toBe(true);
  });
});

describe("normalizeWebhookEvents", () => {
  it("accepts a single event", () => {
    const event = { id: "m1" };
    expect(normalizeWebhookEvents(event)).toEqual([event]);
  });

  it("accepts an event array", () => {
    const events = [{ id: "m1" }, { id: "m2" }, { not: "an event" }];
    const normalized = normalizeWebhookEvents(events);
    expect(normalized).toHaveLength(2);
  });

  it("accepts a wrapper object with an events array", () => {
    expect(normalizeWebhookEvents({ events: [{ id: "m1" }] })).toEqual([
      { id: "m1" },
    ]);
  });

  it("returns an empty array for non-events", () => {
    expect(normalizeWebhookEvents("nope")).toEqual([]);
  });
});

describe("isRecord", () => {
  it("narrows plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("opaqueString", () => {
  it("reads the first non-empty string across keys", () => {
    expect(
      opaqueString({ latitude: "12.3", lat: "9" }, "latitude", "lat")
    ).toBe("12.3");
  });

  it("converts finite numbers to strings", () => {
    expect(opaqueString({ latitude: 12.3 }, "latitude")).toBe("12.3");
  });

  it("returns undefined when nothing matches", () => {
    expect(opaqueString({}, "nope")).toBeUndefined();
  });
});

describe("webhookString", () => {
  it("returns non-empty string values", () => {
    expect(webhookString({ id: "m1", text: "hi" }, "text")).toBe("hi");
    expect(webhookString({ id: "m1" }, "text")).toBeUndefined();
  });
});

describe("inboundAuthor", () => {
  it("prefers the sender name and falls back to waId", () => {
    const author = inboundAuthor({ id: "m1", senderName: "Bob" }, "1415");
    expect(author).toMatchObject({
      userId: "1415",
      fullName: "Bob",
      isMe: false,
    });
  });
});

describe("extractText", () => {
  it("returns the body for text events", () => {
    expect(extractText({ id: "m1", type: "text", text: "hi" })).toBe("hi");
  });

  it("returns placeholders for media types", () => {
    expect(extractText({ id: "m1", type: "image" })).toBe("[Image]");
    expect(extractText({ id: "m1", type: "document" })).toBe("[Document]");
  });

  it("formats location coordinates when available", () => {
    expect(
      extractText({
        id: "m1",
        type: "location",
        data: { latitude: 1, longitude: 2 },
      })
    ).toBe("[Location: 1, 2]");
  });

  it("is empty for unknown types", () => {
    expect(extractText({ id: "m1" })).toBe("");
  });
});

describe("eventDate", () => {
  it("parses the created timestamp", () => {
    const date = eventDate({ id: "m1", created: "2024-01-15T10:30:00Z" });
    expect(date.toISOString()).toBe("2024-01-15T10:30:00.000Z");
  });

  it("handles epoch seconds", () => {
    expect(eventDate({ id: "m1", timestamp: "1705314600" }).getTime()).toBe(
      1705314600000
    );
  });

  it("handles epoch milliseconds", () => {
    expect(eventDate({ id: "m1", timestamp: "1705314600000" }).getTime()).toBe(
      1705314600000
    );
  });

  it("falls back to the current time", () => {
    expect(eventDate({ id: "m1" }).getTime()).toBeGreaterThan(0);
  });
});

describe("parsePageCursor", () => {
  it("defaults to page 1", () => {
    expect(parsePageCursor()).toBe(1);
    expect(parsePageCursor("")).toBe(1);
  });

  it("parses positive integers", () => {
    expect(parsePageCursor("3")).toBe(3);
  });

  it("rejects invalid cursors", () => {
    expect(() => parsePageCursor("abc")).toThrow();
    expect(() => parsePageCursor("0")).toThrow();
    expect(() => parsePageCursor("-1")).toThrow();
  });
});

describe("inferMimeType", () => {
  it("maps known extensions", () => {
    expect(inferMimeType("photo.jpg")).toBe("image/jpeg");
    expect(inferMimeType("doc.pdf")).toBe("application/pdf");
  });

  it("falls back to octet-stream", () => {
    expect(inferMimeType("file.xyz")).toBe("application/octet-stream");
  });
});

describe("webhookPathSecret", () => {
  it("extracts the secret segment after webhook", () => {
    expect(webhookPathSecret("/api/wati/webhook/abc123")).toBe("abc123");
  });

  it("returns null when missing or terminal", () => {
    expect(webhookPathSecret("/api/wati/webhook")).toBeNull();
    expect(webhookPathSecret("/api/wati/other")).toBeNull();
  });
});

describe("isBsuid", () => {
  it("matches BSUID-shaped strings", () => {
    expect(isBsuid("US.123124141512")).toBe(true);
    expect(isBsuid("14155552671")).toBe(false);
  });
});

describe("isAllowedApiPath", () => {
  it("accepts documented API prefixes only", () => {
    expect(isAllowedApiPath("/api/v1/getContacts")).toBe(true);
    expect(isAllowedApiPath("/api/v2/webhookEndpoints")).toBe(true);
    expect(isAllowedApiPath("/api/ext/v3/channels")).toBe(true);
    expect(isAllowedApiPath("https://evil.com/api/v1/getContacts")).toBe(false);
  });
});

describe("normalizeBearerCredential", () => {
  it("strips the Bearer prefix and trims", () => {
    expect(normalizeBearerCredential("  Bearer abc123  ")).toBe("abc123");
    expect(normalizeBearerCredential("abc123")).toBe("abc123");
  });
});

describe("redactWatiErrorBody", () => {
  it("redacts tokens, JWTs, emails, and phone numbers", () => {
    const body =
      "token wati_abc123 jwt eyJhbGci email bob@example.com phone +14155552671";
    const redacted = redactWatiErrorBody(body);
    expect(redacted).toContain("[redacted-token]");
    expect(redacted).toContain("[redacted-email]");
    expect(redacted).toContain("[redacted-number]");
    expect(redacted).not.toContain("wati_abc123");
    expect(redacted).not.toContain("bob@example.com");
  });
});

describe("redactWatiApiPath", () => {
  it("strips the query string", () => {
    expect(redactWatiApiPath("/api/v1/getContacts?pageNumber=1")).toBe(
      "/api/v1/getContacts"
    );
  });

  it("redacts phone numbers and BSUIDs in path segments", () => {
    expect(redactWatiApiPath("/api/v1/getMessages/14155552671")).toBe(
      "/api/v1/getMessages/[redacted-number]"
    );
    expect(redactWatiApiPath("/api/ext/v3/contacts/US.123")).toBe(
      "/api/ext/v3/contacts/[redacted-bsuid]"
    );
  });
});
