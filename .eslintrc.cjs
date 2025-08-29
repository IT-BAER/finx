module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: { version: "detect" },
  },
  plugins: ["react", "react-hooks", "import"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    // React 17+ with new JSX transform doesn't require React in scope
    "react/react-in-jsx-scope": "off",
    // We're not using prop-types in this project
    "react/prop-types": "off",
    // Helpful defaults; allow intentionally unused with leading underscore
    "no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ],
    // Keep consoles as warnings; errors are fine
    "no-console": ["warn", { allow: ["warn", "error"] }],
    // Keep imports tidy
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "object",
          "type",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.spec.js", "**/__tests__/**/*"],
      env: { jest: true },
    },
    {
      files: ["**/*.jsx"],
      rules: {
        // Relax this to avoid noise for simple component literals
        "react/display-name": "off",
      },
    },
  ],
};

