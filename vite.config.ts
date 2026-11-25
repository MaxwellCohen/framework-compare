import { defineConfig } from "vite";
import { pracht } from "@pracht/vite-plugin";
import { staticAdapter } from "@pracht/adapter-static";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    pracht({
      adapter: staticAdapter(),
      // Put each page's CSS in the document: no render-blocking stylesheet request.
      inlineCss: true,
    }),
    tailwindcss(),
  ],
});
