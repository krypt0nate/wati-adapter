/**
 * Markdown conversion for the Wati (WhatsApp) adapter.
 *
 * Wati renders WhatsApp's markdown dialect, which differs from the Chat SDK's
 * canonical dialect in two ways:
 *
 * - Inline markers use single characters: `*bold*` and `~strike~` instead of
 *   `**strong**` and `~~delete~~`.
 * - Block-level syntax (headings, horizontal rules, tables) is not supported
 *   at all.
 *
 * This module bridges the two dialects by transforming the AST before
 * stringifying (outbound) and normalizing single-character markers before
 * parsing (inbound).
 */

import {
  type AdapterPostableMessage,
  BaseFormatConverter,
  type Content,
  isTableNode,
  parseMarkdown,
  type Root,
  stringifyMarkdown,
  tableToAscii,
  walkAst,
} from "chat";

/**
 * Format converter between the Chat SDK AST and Wati's WhatsApp markdown.
 *
 * WhatsApp has no block-level markdown, so unsupported nodes are flattened
 * during outbound rendering:
 *
 * - Headings become bold paragraphs (nested strong is flattened so the
 *   result never contains the `***` triple marker).
 * - Thematic breaks become a paragraph containing a `---` text separator.
 * - Tables become code blocks containing an ASCII-rendered table (the same
 *   approach as the Telegram adapter).
 *
 * Inline markers are converted both directions between the canonical
 * `**`/`~~` forms and WhatsApp's single-character `*`/`~` forms.
 */
export class WatiFormatConverter extends BaseFormatConverter {
  /**
   * Render an AST to Wati's WhatsApp markdown.
   *
   * First the AST is transformed to drop the block-level nodes WhatsApp
   * cannot render, then it is stringified with `_` emphasis and `-` bullets
   * so the only `*` character the serializer emits is the `**` from strong.
   * A final pass rewrites `**` → `*` and `~~` → `~` to match WhatsApp's
   * single-character syntax.
   */
  fromAst(ast: Root): string {
    const transformed = walkAst(structuredClone(ast), (node: Content) => {
      // Headings -> bold paragraph (flatten nested strong to avoid ***)
      if (node.type === "heading") {
        const heading = node as Content & { children: Content[] };
        const children = heading.children.flatMap((child) =>
          child.type === "strong"
            ? (child as Content & { children: Content[] }).children
            : [child]
        );
        return {
          type: "paragraph",
          children: [{ type: "strong", children }],
        } as Content;
      }
      // Thematic breaks -> text separator
      if (node.type === "thematicBreak") {
        return {
          type: "paragraph",
          children: [{ type: "text", value: "---" }],
        } as Content;
      }
      // Tables -> code blocks (same as Telegram)
      if (isTableNode(node)) {
        return {
          type: "code" as const,
          value: tableToAscii(node),
          lang: undefined,
        } as Content;
      }
      return node;
    });
    // Use _ for emphasis and - for bullets so the only * in output is **strong**
    const markdown = stringifyMarkdown(transformed, {
      emphasis: "_",
      bullet: "-",
    }).trim();
    // Single-character markers for WhatsApp: **strong** -> *bold*, ~~delete~~ -> ~strike~
    return markdown
      .replace(/\*\*(.+?)\*\*/g, "*$1*")
      .replace(/~~(.+?)~~/g, "~$1~");
  }

  /**
   * Parse Wati's WhatsApp markdown into the canonical AST.
   *
   * Inbound messages arrive with WhatsApp's single-character syntax. The
   * single `*` and `~` markers are upgraded to the canonical `**` and `~~`
   * forms (taking care not to match text already using the doubled forms)
   * so the standard parser produces the correct mdast nodes.
   */
  toAst(markdown: string): Root {
    const standard = markdown
      .replace(/(?<!\*)\*(?!\*)([^\n*]+?)(?<!\*)\*(?!\*)/g, "**$1**")
      .replace(/(?<!~)~(?!~)([^\n~]+?)(?<!~)~(?!~)/g, "~~$1~~");
    return parseMarkdown(standard);
  }

  /**
   * Render any postable message shape to Wati markdown.
   *
   * Plain strings and raw postables pass through untouched since they are
   * already in Wati's format; markdown and AST postables run through the
   * conversion pipeline; cards and other structured postables fall back to
   * the base implementation.
   */
  override renderPostable(message: AdapterPostableMessage): string {
    if (typeof message === "string") {
      return message;
    }
    if ("raw" in message) {
      return message.raw;
    }
    if ("markdown" in message) {
      return this.fromMarkdown(message.markdown);
    }
    if ("ast" in message) {
      return this.fromAst(message.ast);
    }
    return super.renderPostable(message);
  }
}
