import { describe, it, expect } from "vitest";
import { sanitizeRichText, isRichText, termsToPrintHtml, RICH_TEXT_MAX } from "@/lib/rich-text";

describe("sanitizeRichText", () => {
  it("keeps the formatting a receipt can actually print", () => {
    expect(sanitizeRichText("<b>Bold</b> and <i>italic</i>")).toBe("<b>Bold</b> and <i>italic</i>");
    expect(sanitizeRichText("<ul><li>One</li><li>Two</li></ul>")).toBe("<ul><li>One</li><li>Two</li></ul>");
    expect(sanitizeRichText("line<br>break")).toBe("line<br />break");
  });

  it("drops script and style along with their contents", () => {
    expect(sanitizeRichText('<script>alert("x")</script>Terms')).toBe("Terms");
    expect(sanitizeRichText("<style>body{display:none}</style>Terms")).toBe("Terms");
    expect(sanitizeRichText("<script src=//evil.test/x.js>")).toBe("");
  });

  it("strips every attribute, because tags are regenerated from the name alone", () => {
    expect(sanitizeRichText('<b onclick="steal()">Hi</b>')).toBe("<b>Hi</b>");
    expect(sanitizeRichText('<p style="position:fixed;top:0">Hi</p>')).toBe("<p>Hi</p>");
    expect(sanitizeRichText('<b onmouseover=alert(1)>Hi</b>')).toBe("<b>Hi</b>");
  });

  it("removes tags that are not on the allowlist but keeps their text", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">Click</a>')).toBe("Click");
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBe("");
    expect(sanitizeRichText("<iframe></iframe>Terms")).toBe("Terms");
  });

  it("removes comments, which can hide conditional markup", () => {
    expect(sanitizeRichText("<!--[if IE]><script>x</script><![endif]-->Terms")).toBe("Terms");
  });

  it("treats a stray angle bracket as text rather than an opening tag", () => {
    expect(sanitizeRichText("price < 500")).toBe("price &lt; 500");
  });

  it("caps runaway input", () => {
    expect(sanitizeRichText("a".repeat(RICH_TEXT_MAX + 500)).length).toBeLessThanOrEqual(RICH_TEXT_MAX);
  });

  it("handles empty input", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText(undefined)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });
});

describe("termsToPrintHtml", () => {
  // Terms saved before the editor existed are plain text with newlines, and
  // must keep printing exactly as they did.
  it("renders legacy plain text with line breaks and escaping", () => {
    expect(termsToPrintHtml("No returns\nWarranty 7 days")).toBe("No returns<br />Warranty 7 days");
    expect(termsToPrintHtml("Tom & Jerry <shop>")).toBe("Tom &amp; Jerry &lt;shop&gt;");
  });

  it("passes rich text through the sanitizer", () => {
    expect(termsToPrintHtml('<ul><li onclick="x()">One</li></ul>')).toBe("<ul><li>One</li></ul>");
  });

  it("recognises markup vs plain text", () => {
    expect(isRichText("<b>x</b>")).toBe(true);
    expect(isRichText("plain text")).toBe(false);
  });
});
