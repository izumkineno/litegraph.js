import { defineConfig } from "vite";

const FULL_RELOAD_PATTERN =
  /[\\/](editor|src)[\\/].+\.(?:html|css|js|ts)$/i;
const WATCH_GLOBS = [
  "editor/**/*.{html,css,js,ts}",
  "src/**/*.{html,css,js,ts}",
];

function litegraphEditorFullReload() {
  return {
    name: "litegraph-editor-full-reload",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (
          req.url === "/editor/index-ts.html" ||
          req.url === "/editor/index-ts.html/"
        ) {
          res.statusCode = 302;
          res.setHeader("Location", "/editor/index-ts-vite.html");
          res.end();
          return;
        }
        next();
      });

      server.watcher.add(WATCH_GLOBS);
    },
    handleHotUpdate(context) {
      if (!FULL_RELOAD_PATTERN.test(context.file)) {
        return;
      }

      context.server.ws.send({
        type: "full-reload",
        path: "*",
      });

      return [];
    },
  };
}

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4175,
    open: "/editor/index-ts-vite.html",
    watch: {
      usePolling: true,
      interval: 120,
      awaitWriteFinish: {
        stabilityThreshold: 180,
        pollInterval: 60,
      },
    },
  },
  plugins: [litegraphEditorFullReload()],
});
