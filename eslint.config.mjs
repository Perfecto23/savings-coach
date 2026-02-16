import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler purity/immutability rules - downgrade to warnings
      // These flag legitimate patterns like setState in effects responding to prop changes
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // setState in effect is a common React pattern (e.g. confetti animation responding to prop)
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
