import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // New advisory rules that ship with eslint-config-next 16 (they prepare code for the React Compiler,
    // which LazyAI does not use). The flagged spots behave correctly today: server pages read the clock
    // while rendering, a click handler writes into a hidden field, and three client components fill in
    // browser-only values after the page loads. They are warnings so they stay visible without blocking a deploy.
    // If the React Compiler is ever turned on, fix these first.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);
