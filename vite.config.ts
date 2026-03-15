import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyExtensionAssets(): Plugin {
  return {
    name: "copy-extension-assets",
    async closeBundle() {
      const publicDir = resolve(__dirname, "public");
      const distDir = resolve(__dirname, "dist");
      const manifestSource = resolve(publicDir, "manifest.json");
      const manifestTarget = resolve(distDir, "manifest.json");
      const iconsSource = resolve(publicDir, "icons");
      const iconsTarget = resolve(distDir, "icons");
      const iconFiles = ["icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png"];

      const manifest = await readFile(manifestSource, "utf8");
      await writeFile(manifestTarget, manifest);

      await rm(iconsTarget, { recursive: true, force: true });
      await mkdir(iconsTarget, { recursive: true });

      for (const iconFile of iconFiles) {
        await cp(resolve(iconsSource, iconFile), resolve(iconsTarget, iconFile));
      }
    },
  };
}

export default defineConfig({
  plugins: [copyExtensionAssets()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const entries: Record<string, string> = {
            background: "background.js",
            content: "content.js",
          };

          return entries[chunkInfo.name] ?? "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
