import { describe, expect, it } from "vitest";
import { WatiFormatConverter } from "./markdown";

const converter = new WatiFormatConverter();

describe("WatiFormatConverter.toAst", () => {
  it("parses standard markdown", () => {
    const ast = converter.toAst("*bold* and _italic_");
    expect(ast.children[0].children).toHaveLength(3);
  });

  it("promotes single asterisks to strong", () => {
    const ast = converter.toAst("*bold*");
    expect(ast.children[0].children[0]).toMatchObject({ type: "strong" });
  });

  it("promotes single tildes to delete", () => {
    const ast = converter.toAst("~strike~");
    expect(ast.children[0].children[0]).toMatchObject({ type: "delete" });
  });

  it("leaves doubled markers intact", () => {
    const ast = converter.toAst("**bold**");
    expect(ast.children[0].children[0]).toMatchObject({ type: "strong" });
  });
});

describe("WatiFormatConverter.fromAst", () => {
  it("renders headings as bold paragraphs", () => {
    const text = converter.fromAst(converter.toAst("# Title"));
    expect(text).toBe("*Title*");
  });

  it("renders thematic breaks as separators", () => {
    const text = converter.fromAst(converter.toAst("a\n\n---\n\nb"));
    expect(text).toContain("---");
  });

  it("renders tables as ASCII code blocks", () => {
    const text = converter.fromAst(
      converter.toAst("| a | b |\n|---|---|\n| 1 | 2 |")
    );
    expect(text).toContain("a | b");
    expect(text).toContain("1 | 2");
    expect(text).toContain("```");
  });

  it("renders strong with WhatsApp's single asterisk", () => {
    const text = converter.fromAst(converter.toAst("**bold**"));
    expect(text).toContain("*bold*");
  });

  it("renders strikethrough with WhatsApp's single tilde", () => {
    const text = converter.fromAst(converter.toAst("~~strike~~"));
    expect(text).toContain("~strike~");
  });
});

describe("WatiFormatConverter.renderPostable", () => {
  it("passes plain strings through", () => {
    const text = converter.renderPostable("hello *world*");
    expect(text).toBe("hello *world*");
  });

  it("renders markdown postables", () => {
    const text = converter.renderPostable({ markdown: "# Big" });
    expect(text).toBe("*Big*");
  });

  it("renders raw postables as-is", () => {
    const text = converter.renderPostable({ raw: "raw text" });
    expect(text).toBe("raw text");
  });
});
