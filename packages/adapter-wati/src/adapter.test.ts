import { ConsoleLogger } from "chat";
import { describe, expect, it } from "vitest";
import { WatiAdapter } from "./adapter";

const config = {
  accessToken: "wati_test_token",
  apiUrl: "https://live-mt-server.wati.io/tenant",
  webhookSecret: "secret",
  userName: "wati-bot",
  logger: new ConsoleLogger("error"),
};

describe("WatiAdapter thread IDs", () => {
  it("encodes and decodes waIds round-trip", () => {
    const adapter = new WatiAdapter(config);
    const threadId = adapter.encodeThreadId({ waId: "14155552671" });
    expect(threadId.startsWith("wati:")).toBe(true);
    expect(adapter.decodeThreadId(threadId)).toEqual({ waId: "14155552671" });
  });

  it("handles BSUIDs with dots", () => {
    const adapter = new WatiAdapter(config);
    const threadId = adapter.encodeThreadId({ waId: "US.123124141512" });
    expect(adapter.decodeThreadId(threadId)).toEqual({
      waId: "US.123124141512",
    });
  });

  it("handles segments with special characters via base64url", () => {
    const adapter = new WatiAdapter(config);
    const threadId = adapter.encodeThreadId({ waId: "a:b/c" });
    expect(threadId).not.toContain("a:b");
    expect(adapter.decodeThreadId(threadId)).toEqual({ waId: "a:b/c" });
  });

  it("rejects non-wati thread IDs", () => {
    const adapter = new WatiAdapter(config);
    expect(() => adapter.decodeThreadId("slack:C123")).toThrow();
  });

  it("rejects invalid base64url segments", () => {
    const adapter = new WatiAdapter(config);
    expect(() => adapter.decodeThreadId("wati:!!not-base64url!!")).toThrow();
  });

  it("rejects empty thread IDs", () => {
    const adapter = new WatiAdapter(config);
    expect(() => adapter.decodeThreadId("wati:")).toThrow();
    expect(() => adapter.encodeThreadId({ waId: "  " })).toThrow();
  });

  it("openDM produces a decodable thread ID", async () => {
    const adapter = new WatiAdapter(config);
    const threadId = await adapter.openDM("14155552671");
    expect(adapter.decodeThreadId(threadId)).toEqual({ waId: "14155552671" });
  });
});

describe("WatiAdapter metadata", () => {
  it("exposes the adapter name", () => {
    expect(new WatiAdapter(config).name).toBe("wati");
  });

  it("treats every thread as a DM", () => {
    const adapter = new WatiAdapter(config);
    const threadId = adapter.encodeThreadId({ waId: "14155552671" });
    expect(adapter.isDM(threadId)).toBe(true);
    expect(adapter.channelIdFromThreadId(threadId)).toBe(threadId);
  });
});
