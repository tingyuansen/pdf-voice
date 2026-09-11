import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "dist/**", "desktop-dist/**", "work/**", "next-env.d.ts"]),
  {
    files: ["**/*.cjs"],
    rules: {
      // Electron's main process and the packaged local server are CommonJS.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["app/**/*.tsx"],
    rules: {
      // The reader synchronises React state with pdf.js, the audio element,
      // localStorage and scroll position from effects on purpose.
      "react-hooks/set-state-in-effect": "off",
      // Crops of equations and figures are data URLs rasterised from the
      // PDF page; there is nothing for an image loader to optimise.
      "@next/next/no-img-element": "off",
    },
  },
]);
