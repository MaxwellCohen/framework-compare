import { defineApp, route } from "@pracht/core";

// App-level choices (see src/components/README.md, "Interactivity"):
// - Every page is `hydration: "islands"`: HTML + CSS only, and JavaScript is
//   loaded just for components imported from `src/islands/`. A page that
//   renders no island ships no framework JavaScript at all.
// - Islands pages navigate with full page loads, so `speculation: "prefetch"`
//   lets the browser warm the next document, and `viewTransitions` cross-fades
//   the load. Both are declarative: no client code.

export const app = defineApp({
  shells: {
    public: "./shells/public.tsx",
  },
  routes: [
    route("/", "./routes/home.tsx", { id: "home", render: "ssg", shell: "public", hydration: "islands", speculation: "prefetch" }),
    route("/features/:id", "./routes/features/[id].tsx", {
      id: "feature",
      render: "ssg",
      shell: "public",
      hydration: "islands",
      speculation: "prefetch",
    }),
    route("/frameworks/:id", "./routes/frameworks/[id].tsx", {
      id: "framework",
      render: "ssg",
      shell: "public",
      hydration: "islands",
      speculation: "prefetch",
    }),
    route("/compare", "./routes/compare.tsx", {
      id: "compare",
      render: "ssg",
      shell: "public",
      hydration: "islands",
      speculation: "prefetch",
    }),
    route("/measured", "./routes/measured.tsx", {
      id: "measured",
      render: "ssg",
      shell: "public",
      hydration: "islands",
      speculation: "prefetch",
    }),
    route("/methodology", "./routes/methodology.tsx", {
      id: "methodology",
      render: "ssg",
      shell: "public",
      hydration: "islands",
      speculation: "prefetch",
    }),
  ],
  // Rendered with a 404 status when nothing matches. Not a route: it never
  // matches a URL, so it cannot shadow static assets or later pages.
  notFound: {
    component: "./routes/not-found.tsx",
    shell: "public",
    hydration: "islands",
  },
  viewTransitions: true,
  // Declarative invariants enforced by `pracht verify` — uncomment to use
  // (add the helpers to the @pracht/core import):
  // constraints: [
  //   requireHead("**"),
  // ],
});
