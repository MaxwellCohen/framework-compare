import type { ComponentChildren } from "preact";
import { Link } from "@pracht/core";
import type { FeatureId, FrameworkId } from "../data/types.ts";

/**
 * A typed in-site destination. Every component that links somewhere takes one
 * of these (prop name `to`) instead of a path string, so links stay bound to
 * route ids.
 *
 *   { route: "home", hash: "matrix" }
 *   { route: "feature", id: "css-inlining" }
 *   { route: "framework", id: "nuxt", hash: "deployments" }
 */
export type Target =
  | { route: "home" | "compare" | "measured" | "benchmark" | "methodology"; hash?: string }
  | { route: "feature"; id: FeatureId; hash?: string }
  | { route: "framework"; id: FrameworkId; hash?: string };

interface AnchorPassthrough {
  class?: string;
  title?: string;
  id?: string;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
  children?: ComponentChildren;
}

/** In-site link by typed `Target`. Unstyled — add `class="link"` for a text link. */
export function NavLink({ to, children, ...rest }: { to: Target } & AnchorPassthrough) {
  if (to.route === "feature") {
    return (
      <Link route="feature" params={{ id: to.id }} hash={to.hash} {...rest}>
        {children}
      </Link>
    );
  }
  if (to.route === "framework") {
    return (
      <Link route="framework" params={{ id: to.id }} hash={to.hash} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <Link route={to.route} hash={to.hash} {...rest}>
      {children}
    </Link>
  );
}

/** Off-site link: underlined, with a trailing arrow glyph. Use for repos, deployments, vendor docs. */
export function ExternalLink({
  href,
  children,
  class: cls = "",
  bare = false,
}: {
  href: string;
  children: ComponentChildren;
  class?: string;
  /** Drop the underline (e.g. inside a table of URLs); the arrow stays. */
  bare?: boolean;
}) {
  return (
    <a href={href} rel="noopener" class={`ext ${bare ? "hover:text-accent" : "link"} ${cls}`}>
      {children}
    </a>
  );
}
