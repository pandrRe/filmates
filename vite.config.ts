import { defineConfig } from "vite";
import { octane } from "octane/compiler/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { octaneRouteGeneratorPlugin } from "@octanejs/tanstack-router/generator-plugin";

export default defineConfig({
  resolve: {
    alias: { "@tanstack/react-router": "@octanejs/tanstack-router" },
  },
  optimizeDeps: {
    exclude: ["@tanstack/react-router", "@octanejs/tanstack-router", "@octanejs/base-ui"],
  },
  plugins: [
    tanstackRouter({
      target: "react",
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
      plugins: [octaneRouteGeneratorPlugin()],
    }),
    octane(),
  ],
  build: { target: "esnext" },
});
