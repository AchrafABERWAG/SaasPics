import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Textes en français : les apostrophes et guillemets dans le JSX sont voulus.
      "react/no-unescaped-entities": "off",
      // Les photos viennent du stockage Supabase (URL publiques) : <img> volontaire, pour ne pas
      // payer l'optimisation d'images de l'hébergeur sur chaque photo d'invité.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
