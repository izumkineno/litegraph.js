import { defineConfig } from "vite";

const FULL_RELOAD_PATTERN =
  /[\\/](editor|src)[\\/].+\.(?:html|css|js|ts)$/i;

function litegraphEditorFullReload() {
  return {
    name: "litegraph-editor-full-reload",
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
  },
  plugins: [litegraphEditorFullReload()],
});
