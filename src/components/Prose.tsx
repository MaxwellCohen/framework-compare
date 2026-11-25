/**
 * Renders trusted, pre-rendered HTML (the `*Html` fields of src/data) with the
 * site's typographic styling: paragraphs, links, lists, inline code, tables,
 * blockquotes, and Shiki dual-theme code blocks (see `.prose` in global.css).
 *
 * Two small rewrites happen here, at render time on the server:
 *  - an italic-only paragraph directly after a code block becomes its caption;
 *  - tables are wrapped in a focusable horizontal scroller.
 *
 * `size="sm"` uses the 15px UI size — for cells, cards, and callouts.
 * Never pass user input: the HTML is injected as-is.
 */
export function Prose({
  html,
  size = "md",
  as: Tag = "div",
  class: cls = "",
}: {
  html: string;
  size?: "sm" | "md";
  as?: "div" | "article" | "section";
  class?: string;
}) {
  return (
    <Tag class={`prose ${size === "sm" ? "prose-sm" : ""} ${cls}`} dangerouslySetInnerHTML={{ __html: enhance(html) }} />
  );
}

function enhance(html: string) {
  return html
    // The data build already marks captions as <p class="caption">.
    .replace(/<p class="caption">/g, '<p class="prose-caption">')
    .replace(/(<\/pre>\s*)<p>(\s*<em>[\s\S]*?<\/em>\s*)<\/p>/g, (match, lead: string, inner: string) =>
      // Only when the <em> spans the whole paragraph.
      inner.indexOf("</em>") === inner.lastIndexOf("</em>") ? `${lead}<p class="prose-caption">${inner}</p>` : match,
    )
    .replace(/<table[\s>][\s\S]*?<\/table>/g, (table) => `<div class="prose-table" tabindex="0" role="group">${table}</div>`);
}
