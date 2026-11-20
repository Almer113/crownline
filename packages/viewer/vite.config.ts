import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// In development, /chart/<file> serves the engine's output from the repository root (the built chart page,
// its layout file, and the assets it references). The publish step (Phase 2.6) copies the same files.
// chart/chart.html and chart/chart.layout.json are the page CHART_PAGE names (default wangsa-mataram-public).
const PAGE = process.env.CHART_PAGE ?? "wangsa-mataram-public";
const REPO = normalize(fileURLToPath(new URL("../..", import.meta.url)));
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ttf": "font/ttf",
};
const ALLOWED = /^([a-z][a-z0-9]*(-[a-z0-9]+)*(\.layout\.json|\.html)|assets\/.+\.(jpe?g|png|webp|svg|ttf))$/;

const SIZED = /^portraits\/(?:[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+-\d+\.webp$/;

function chartFiles(): Plugin {
  return {
    name: "crownline-chart-files",
    configureServer(server) {
      server.middlewares.use("/chart/", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "")
          .replace(/^chart(\.html|\.layout\.json)$/, `${PAGE}$1`);
        // portrait copies come from tools/portrait_sizes.py's output folder
        const file = SIZED.test(rel) ? normalize(join(REPO, ".cache", rel)) : normalize(join(REPO, rel));
        if (rel.split("/").includes("..") || !(ALLOWED.test(rel) || SIZED.test(rel)) || !file.startsWith(REPO)
            || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "./", // relative links, so the published folder works under any path (e.g. user.github.io/repo/)
  plugins: [chartFiles()],
  server: { port: 5173, strictPort: true },
  build: { target: "es2022" },
});
