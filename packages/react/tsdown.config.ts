import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  clean: true,
  platform: "neutral",
  external: ["react", "react-dom", "@twist-toast/core"],
});
