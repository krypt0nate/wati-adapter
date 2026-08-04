import { describe, expect, it } from "vitest";
import { CALLBACK_TOKEN_PREFIX, cardToWati, cardToWatiText } from "./cards";

const card = (overrides: Record<string, unknown> = {}) =>
  ({
    type: "card",
    title: "Buy now",
    children: [],
    ...overrides,
  }) as never;

const actionsCard = (buttons: unknown[]) =>
  card({ children: [{ type: "actions", children: buttons }] });

describe("cardToWati", () => {
  it("renders an interactive buttons message when within limits", () => {
    const result = cardToWati(
      actionsCard([
        { type: "button", id: "b1", label: "Yes", value: undefined },
      ]) as never
    );
    expect(result).toMatchObject({
      type: "interactive",
      interactive: {
        type: "buttons",
        button_message: {
          header: { type: "text", text: "Buy now" },
          buttons: [{ text: "Yes" }],
        },
      },
    });
  });

  it("falls back to text when there are no buttons", () => {
    const result = cardToWati(card() as never);
    expect(result.type).toBe("text");
  });

  it("falls back to text when there are too many buttons", () => {
    const many = Array.from({ length: 4 }, (_, i) => ({
      type: "button",
      id: `b${i}`,
      label: `B${i}`,
    }));
    expect(cardToWati(actionsCard(many) as never).type).toBe("text");
  });

  it("ignores disabled buttons", () => {
    const result = cardToWati(
      actionsCard([
        {
          type: "button",
          id: "b1",
          label: "On",
          disabled: true,
          value: undefined,
        },
        { type: "button", id: "b2", label: "Off" },
      ]) as never
    );
    expect(result.type).toBe("interactive");
    expect(
      (
        result as never as {
          interactive: { button_message: { buttons: unknown[] } };
        }
      ).interactive.button_message.buttons
    ).toHaveLength(1);
  });

  it("truncates button titles to 20 characters", () => {
    const result = cardToWati(
      actionsCard([
        { type: "button", id: "b1", label: "x".repeat(50), value: undefined },
      ]) as never
    );
    const buttons = (
      result as never as {
        interactive: { button_message: { buttons: Array<{ text: string }> } };
      }
    ).interactive.button_message.buttons;
    expect(buttons[0].text.length).toBe(20);
  });

  it("throws on callback-token buttons", () => {
    expect(() =>
      cardToWati(
        actionsCard([
          {
            type: "button",
            id: "b1",
            label: "Go",
            value: `${CALLBACK_TOKEN_PREFIX}${"a".repeat(16)}`,
          },
        ]) as never
      )
    ).toThrow();
  });
});

describe("cardToWatiText", () => {
  it("renders title, subtitle, and image", () => {
    const text = cardToWatiText(
      card({
        title: "Title",
        subtitle: "Sub",
        imageUrl: "https://x/y.png",
      }) as never
    );
    expect(text).toContain("*Title*");
    expect(text).toContain("Sub");
    expect(text).toContain("https://x/y.png");
  });

  it("renders text children honoring styles", () => {
    const text = cardToWatiText(
      card({
        children: [
          { type: "text", content: "Bold", style: "bold" },
          { type: "text", content: "Muted", style: "muted" },
          { type: "text", content: "Plain" },
        ],
      }) as never
    );
    expect(text).toContain("*Bold*");
    expect(text).toContain("_Muted_");
    expect(text).toContain("Plain");
  });

  it("escapes markdown metacharacters", () => {
    const text = cardToWatiText(
      card({ children: [{ type: "text", content: "a*b" }] }) as never
    );
    expect(text).toContain("a\\*b");
  });
});
