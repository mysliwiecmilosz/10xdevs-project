import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, ".gitignore");

const baseConfig = tseslint.config({
  extends: [eslint.configs.recommended, tseslint.configs.strict, tseslint.configs.stylistic],
  rules: {
    "no-console": "warn",
    "no-unused-vars": "off",
    // Project reality: we already use `type` heavily and `any` in a few edge places.
    // Keep these as warnings (or off) to avoid blocking CI on style-only refactors.
    "@typescript-eslint/consistent-type-definitions": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
  },
});

const nodeFilesConfig = tseslint.config({
  files: ["**/*.{js,cjs,mjs}"],
  languageOptions: {
    globals: {
      console: "readonly",
      process: "readonly",
      Buffer: "readonly",
      setTimeout: "readonly",
      clearTimeout: "readonly",
      setInterval: "readonly",
      clearInterval: "readonly",
    },
  },
});

const nodeScriptConfig = tseslint.config({
  files: ["scripts/**/*.{js,cjs,mjs}", "playwright.config.ts", "e2e/**/*.{js,ts}"],
  languageOptions: {
    globals: {
      console: "readonly",
      process: "readonly",
      Buffer: "readonly",
    },
  },
});

// Generated types: keep lint pragmatic (do not enforce stylistic rules here).
const generatedTypesConfig = tseslint.config({
  files: ["src/db/database.types.ts"],
  rules: {
    "@typescript-eslint/consistent-indexed-object-style": "off",
  },
});

const jsxA11yConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [jsxA11y.flatConfigs.recommended],
  languageOptions: {
    ...jsxA11y.flatConfigs.recommended.languageOptions,
  },
  rules: {
    ...jsxA11y.flatConfigs.recommended.rules,
  },
});

const reactConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [pluginReact.configs.flat.recommended],
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      window: true,
      document: true,
    },
  },
  plugins: {
    "react-hooks": eslintPluginReactHooks,
    "react-compiler": reactCompiler,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...eslintPluginReactHooks.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react-compiler/react-compiler": "error",
  },
});

// Must be LAST so it overrides eslint-plugin-prettier defaults.
const prettierRuleOverrides = tseslint.config({
  rules: {
    // Ensure Prettier checks don't fail on Windows CRLF.
    "prettier/prettier": ["error", { endOfLine: "auto" }],
  },
});

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  baseConfig,
  nodeFilesConfig,
  nodeScriptConfig,
  generatedTypesConfig,
  jsxA11yConfig,
  reactConfig,
  eslintPluginAstro.configs["flat/recommended"],
  eslintPluginPrettier,
  prettierRuleOverrides
);
