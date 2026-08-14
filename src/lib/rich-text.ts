/**
 * Minimal rich text support for shop-authored receipt terms.
 *
 * The terms field accepts bold/italic/underline and lists, which the thermal
 * receipt renders as real HTML. That makes it a place where markup written by
 * one staff member is later rendered in the owner's browser, so everything is
 * put through `sanitizeRichText` on save AND on render.
 *
 * The sanitizer works by *regenerating* allowed tags rather than filtering the
 * originals, so no attribute an author wrote — onclick, style, href — can ever
 * survive. Anything not on the allowlist is dropped, text and all for script
 * and style.
 */

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "p", "div"]);

/** Hard cap so a runaway paste can't blow up the receipt or the column. */
export const RICH_TEXT_MAX = 4000;

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";
  let html = input.slice(0, RICH_TEXT_MAX);

  // Executable or style-bearing elements go entirely, including their text.
  html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  html = html.replace(/<(script|style)\b[^>]*>/gi, "");
  // Comments can hide conditional markup.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Rebuild every remaining tag from its name alone; drop the rest.
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_m, rawName: string, offset: number, whole: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED.has(name)) return "";
    const closing = whole.slice(offset, offset + 2) === "</";
    if (name === "br") return "<br />";
    return closing ? `</${name}>` : `<${name}>`;
  });

  // Any leftover angle bracket is literal text, not the start of a tag.
  html = html.replace(/<(?![/a-zA-Z])/g, "&lt;");
  return html.trim();
}

/** True when the value carries markup rather than being plain typed text. */
export function isRichText(value: string | null | undefined): boolean {
  return !!value && /<\/?(b|strong|i|em|u|ul|ol|li|br|p|div)\b/i.test(value);
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Print-ready HTML for the terms block. Plain text written before the editor
 * existed keeps its old newline-to-<br> rendering, so nothing that shops
 * already saved changes appearance.
 */
export function termsToPrintHtml(value: string | null | undefined): string {
  if (!value) return "";
  return isRichText(value)
    ? sanitizeRichText(value)
    : escapeHtml(value).replace(/\n/g, "<br />");
}
