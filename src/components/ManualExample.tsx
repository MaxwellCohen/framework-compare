import { Prose } from "./Prose.tsx";

/**
 * A site-authored code sample for a Manual cell, set apart from the quoted
 * source how-to above it so readers can tell the two apart.
 */
export function ManualExample({ html, class: className = "" }: { html: string; class?: string }) {
  return (
    <div class={`mt-4 max-w-prose border-l-2 border-rule-strong pl-3 ${className}`}>
      <p class="eyebrow">Build it yourself: example</p>
      <p class="mt-1 text-xs text-ink-3">
        Written for this site as a starting point. It is not part of the source comparison.
      </p>
      <Prose html={html} size="sm" class="mt-2" />
    </div>
  );
}
