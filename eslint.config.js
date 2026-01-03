const js = require("@eslint/js");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const importPlugin = require("eslint-plugin-import");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = [
  // Ignore patterns (flat config replaces .eslintignore)
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "public/**",
      "frontend/public/**",
    ],
  },

  // Core recommended rules
  js.configs.recommended,

  // TypeScript configuration for .ts and .tsx files
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),

  // Project rules for JS/JSX
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    rules: {
      // Include recommended rules from React + Hooks if available
      ...(react.configs?.recommended?.rules ?? {}),
      ...(reactHooks.configs?.recommended?.rules ?? {}),

      // Project-specific tweaks (tuned to reduce noise now; we can tighten later)
      "react/react-in-jsx-scope": "off", // New JSX transform
      "react/prop-types": "off", // Not using prop-types
      "react/display-name": "off",
      "react-hooks/exhaustive-deps": "off",

      // General codebase tolerances (temporarily relaxed)
      "no-unused-vars": "off",
      "no-console": "off",
      "import/order": "off",
      "no-undef": "off",
      "no-empty": ["off", { allowEmptyCatch: true }],
      "no-useless-escape": "off",
      "no-unsafe-finally": "off",
    },
  },

  // TypeScript rules with React support
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    rules: {
      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react-hooks/exhaustive-deps": "off",

      // TypeScript specific rules (relaxed for gradual adoption)
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];

