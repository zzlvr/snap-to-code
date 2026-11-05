import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // results/ holds local experiments (copies of other sites and the code generated from them): never run those.
    exclude: [...configDefaults.exclude, "results/**"],
  },
});
