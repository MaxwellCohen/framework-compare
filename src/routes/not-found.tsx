import { Container, NavLink } from "../components/index.ts";

export function head() {
  return {
    title: "Page not found — Framework Compare",
    meta: [{ content: "noindex", name: "robots" }],
  };
}

export function Component() {
  return (
    <Container class="py-16 sm:py-24">
      <p class="eyebrow">Error 404</p>
      <h1 class="mt-2 font-display text-3xl sm:text-4xl tracking-[-0.015em] text-ink">Page not found.</h1>
      <p class="mt-4 max-w-prose text-md text-ink-2">
        Nothing lives at this address. It may have moved, or the link may be wrong.
      </p>
      <ul class="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <NavLink to={{ route: "home" }} class="link">
            Capability matrix
          </NavLink>
        </li>
        <li>
          <NavLink to={{ route: "compare" }} class="link">
            Compare frameworks
          </NavLink>
        </li>
        <li>
          <NavLink to={{ route: "methodology" }} class="link">
            Methodology
          </NavLink>
        </li>
      </ul>
    </Container>
  );
}
