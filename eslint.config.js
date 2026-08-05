import js from "@eslint/js";

// Correctness-focused lint gate. Style stays with review discipline; rules
// here exist to catch real defects (unused symbols, undeclared globals,
// unreachable branches), not to argue about formatting.
export default [
  {
    ignores: [
      "node_modules/",
      "**/node_modules/",
      ".tmp/",
      "conformance/",
      "packages/protocol/conformance-bundle.json"
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        Response: "readonly",
        AbortSignal: "readonly",
        globalThis: "readonly",
        crypto: "readonly",
        structuredClone: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true
      }],
      "no-shadow-restricted-names": "error",
      "no-template-curly-in-string": "error",
      "require-atomic-updates": "off",
      // False-positives on the `let x = fallback; try { x = ... }` pattern.
      "no-useless-assignment": "off"
    }
  }
];
