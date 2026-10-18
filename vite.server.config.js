import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "lib/compose-analysis.mjs",
    outDir: "server-dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: { entryFileNames: "compose-analysis.mjs" },
    },
  },
  ssr: { noExternal: ["yaml"] },
});
