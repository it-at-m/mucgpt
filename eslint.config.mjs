// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended, // Spread the recommended configs
  {
    // Add ignores for directories and files you want to exclude
    ignores: [
      "mucgpt-frontend/dist/**",
      "mucgpt-frontend/build/**",
      "mucgpt-frontend/node_modules/**",
    ],
  },
  {
    // Override specific rules here
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
