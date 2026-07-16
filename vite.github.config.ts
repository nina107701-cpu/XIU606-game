import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(projectRoot, "github-pages"),
  publicDir: resolve(projectRoot, "public"),
  base: "/XIU606-game/",
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, "dist-pages"),
    emptyOutDir: true,
  },
});
