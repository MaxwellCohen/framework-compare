/**
 * Head entries for agents and crawlers: the link to a page's markdown twin and
 * its JSON-LD. The twins, /llms.txt, /api/*.json and /sitemap.xml are written
 * by scripts/build-agent-files.mjs.
 */
import site from "./data/site.json";

export const SITE_URL: string = site.url;

/** `<link rel="alternate" type="text/markdown">` for a page. `/` maps to `/index.md`. */
export function markdownAlternate(path: string) {
  return { rel: "alternate", type: "text/markdown", href: path === "/" ? "/index.md" : `${path}.md` };
}

/** A JSON-LD `<script>`. `<` is escaped so no value can close the script element. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c"),
  };
}

const WEBSITE = { "@type": "WebSite", name: site.name, url: `${site.url}/` };

/** JSON-LD for a page that is not the dataset itself. */
export function pageLd(type: "TechArticle" | "WebPage", path: string, title: string, description: string, about?: string) {
  return jsonLd({
    "@type": type,
    [type === "TechArticle" ? "headline" : "name"]: title,
    description,
    url: SITE_URL + path,
    inLanguage: "en",
    isPartOf: WEBSITE,
    ...(about ? { about: { "@type": "Thing", name: about } } : {}),
  });
}

/** JSON-LD for the home page: the matrix as a Dataset, with its JSON and text downloads. */
export function matrixLd(description: string, frameworks: string[], features: string[]) {
  return jsonLd({
    "@type": "Dataset",
    name: `${site.name}: speed features of ${frameworks.length} meta-frameworks`,
    description,
    url: `${SITE_URL}/`,
    isAccessibleForFree: true,
    keywords: [...features, ...frameworks],
    variableMeasured: "Support label per framework and feature: 1st-party (2 points), Experimental (1), Third-party (1), Manual (0)",
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/api/matrix.json` },
      { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: `${SITE_URL}/llms-full.txt` },
    ],
    includedInDataCatalog: { "@type": "DataCatalog", name: `${site.name} data`, url: `${SITE_URL}/api/index.json` },
  });
}
