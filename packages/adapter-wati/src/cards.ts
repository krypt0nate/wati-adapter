/**
 * Card rendering for the Wati (WhatsApp) adapter.
 *
 * Converts Chat SDK {@link CardElement}s into WATI's v3 interactive buttons
 * message when the card fits WhatsApp's interactive schema, falling back to a
 * plain-text rendering otherwise.
 *
 * WhatsApp buttons messages are strictly limited: at most 3 buttons, 20
 * characters per button title, and 1024 characters for the body. Cards that
 * exceed these limits are rendered as text instead of failing.
 */

import { ValidationError } from "@chat-adapter/shared";
import type {
  ActionsElement,
  ButtonElement,
  CardChild,
  CardElement,
} from "chat";
import type { WatiInteractiveMessage } from "./types";

// =============================================================================
// WhatsApp Schema Limits
// =============================================================================

/** Maximum number of buttons in a WhatsApp buttons message. */
const MAX_BUTTONS = 3;
/** Maximum length of a WhatsApp button title. */
const MAX_BUTTON_TITLE = 20;
/** Maximum length of a WhatsApp buttons message body. */
const MAX_BODY = 1024;

/**
 * Chat SDK's callback-URL feature replaces a button's value with this prefix
 * (`__cb:` + 16 hex chars) before the adapter sees it. WATI's v3 interactive
 * schema only accepts visible button text — it has no hidden ID field — so a
 * callback token cannot round-trip. Fail fast instead of sending a button
 * that would silently never trigger its callback.
 */
export const CALLBACK_TOKEN_PREFIX = "__cb:";

/**
 * Reject buttons that carry a Chat SDK callback token.
 *
 * @throws {ValidationError} When the button's value starts with
 *   {@link CALLBACK_TOKEN_PREFIX}, since WATI cannot round-trip callbacks.
 */
function assertNoCallbackToken(button: ButtonElement): void {
  if (button.value?.startsWith(CALLBACK_TOKEN_PREFIX)) {
    throw new ValidationError(
      "wati",
      `WATI buttons cannot round-trip callback tokens: button "${button.label}" uses ` +
        "Button callbackUrl, which WATI's interactive schema cannot carry. " +
        "Use a regular onAction button with a visible label instead."
    );
  }
}

// =============================================================================
// Card Rendering
// =============================================================================

/**
 * Result of rendering a card for Wati.
 *
 * Either an interactive buttons message (when the card fits the WhatsApp
 * schema) or a plain-text fallback.
 */
export type WatiCardResult =
  | { interactive: WatiInteractiveMessage; type: "interactive" }
  | { text: string; type: "text" };

/**
 * Render a card as a Wati interactive buttons message, or fall back to text.
 *
 * When the card has between 1 and {@link MAX_BUTTONS} enabled buttons, it is
 * sent as an interactive buttons message: the card title becomes the text
 * header (truncated to 60 characters) and the body is built from the
 * subtitle and non-action children, defaulting to "Please choose an option"
 * when empty. Callback-token buttons are rejected up front.
 *
 * Otherwise the card is rendered as plain text via {@link cardToWatiText}.
 */
export function cardToWati(card: CardElement): WatiCardResult {
  const actions = findActions(card.children);
  const buttons = actions?.children.filter(
    (child): child is ButtonElement =>
      child.type === "button" && !child.disabled
  );
  buttons?.forEach(assertNoCallbackToken);

  if (buttons?.length && buttons.length <= MAX_BUTTONS) {
    return {
      type: "interactive",
      interactive: {
        type: "buttons",
        button_message: {
          ...(card.title
            ? { header: { type: "text", text: truncate(card.title, 60) } }
            : {}),
          body: truncate(
            buildBody(card) || "Please choose an option",
            MAX_BODY
          ),
          buttons: buttons.map((button) => ({
            text: truncate(button.label, MAX_BUTTON_TITLE),
          })),
        },
      },
    };
  }

  return { type: "text", text: cardToWatiText(card) };
}

/**
 * Render a card as a plain-text fallback message.
 *
 * Composes the card's title (bold), subtitle, image URL, and rendered
 * children into Wati markdown lines, collapsing runs of blank lines and
 * trimming the result.
 */
export function cardToWatiText(card: CardElement): string {
  const lines: string[] = [];
  if (card.title) {
    lines.push(`*${escapeWati(card.title)}*`);
  }
  if (card.subtitle) {
    lines.push(escapeWati(card.subtitle));
  }
  if ((card.title || card.subtitle) && card.children.length) {
    lines.push("");
  }
  if (card.imageUrl) {
    lines.push(card.imageUrl, "");
  }

  for (const child of card.children) {
    lines.push(...renderChild(child));
  }
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Find the first actions element in a card, searching nested sections.
 *
 * @returns The first {@link ActionsElement} found, or `null` when the card
 *   has no action children.
 */
function findActions(children: CardChild[]): ActionsElement | null {
  for (const child of children) {
    if (child.type === "actions") {
      return child;
    }
    if (child.type === "section") {
      const nested = findActions(child.children);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

/**
 * Build the interactive message body from a card.
 *
 * Starts with the card's subtitle, then appends each non-actions child
 * rendered to text. Returns an empty string when there is nothing to show.
 */
function buildBody(card: CardElement): string {
  const parts = card.subtitle ? [card.subtitle] : [];
  for (const child of card.children) {
    if (child.type === "actions") {
      continue;
    }
    const rendered = renderChild(child).join("\n");
    if (rendered) {
      parts.push(rendered);
    }
  }
  return parts.join("\n");
}

/**
 * Render a single card child into Wati markdown text lines.
 *
 * Text children honor their style (bold → `*...*`, muted → `_..._`); field
 * children render as `*label:* value`; tables render as pipe-joined
 * headings and rows; charts render as a `[Chart: title]` placeholder.
 * Actions children are validated for callback tokens and rendered as a
 * pipe-separated row of buttons.
 */
function renderChild(child: CardChild): string[] {
  switch (child.type) {
    case "text":
      if (child.style === "bold") {
        return [`*${escapeWati(child.content)}*`];
      }
      if (child.style === "muted") {
        return [`_${escapeWati(child.content)}_`];
      }
      return [escapeWati(child.content)];
    case "fields":
      return child.children.map(
        (field) => `*${escapeWati(field.label)}:* ${escapeWati(field.value)}`
      );
    case "actions":
      for (const actionChild of child.children) {
        if (actionChild.type === "button" && !actionChild.disabled) {
          assertNoCallbackToken(actionChild);
        }
      }
      return [
        child.children.map(renderActionButton).filter(Boolean).join(" | "),
      ];
    case "section":
      return child.children.flatMap(renderChild);
    case "image":
      return [child.alt ? `${child.alt}: ${child.url}` : child.url];
    case "link":
      return [`${child.label}: ${child.url}`];
    case "divider":
      return ["---"];
    case "table":
      return [
        child.headers.join(" | "),
        child.rows.map((row) => row.join(" | ")).join("\n"),
      ];
    case "chart":
      return [`[Chart: ${child.title}]`];
    default:
      return [];
  }
}

/**
 * Render one action child as Wati text.
 *
 * Link buttons render as `label: url`; action buttons render as `[label]`;
 * select and radio select elements have no label and render as an empty
 * string so the caller can filter them out.
 */
function renderActionButton(
  button: ActionsElement["children"][number]
): string {
  if (button.type === "link-button") {
    return `${escapeWati(button.label)}: ${button.url}`;
  }
  if ("label" in button) {
    return `[${escapeWati(button.label)}]`;
  }
  return "";
}

/**
 * Escape text for Wati's markdown dialect.
 *
 * Backslashes are doubled and the markdown metacharacters `*`, `_`, `~`,
 * and backtick are backslash-escaped so user content renders literally.
 */
function escapeWati(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[*_~`]/g, "\\$&");
}

/**
 * Truncate text to at most `max` characters, appending an ellipsis.
 *
 * Longer strings are cut to `max - 3` characters followed by `...`.
 */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}
