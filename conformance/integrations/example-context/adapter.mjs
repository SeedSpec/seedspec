import { readFile } from "node:fs/promises";

export const adapter = {
  adapter_api_version: "1",
  id: "org.seedspec.fixtures.example-context-adapter",
  version: "1.0.0",
  name: "Example Context Adapter",
  formats: [{
    id: "org.example.context.behavior",
    versions: ["1.0.0"]
  }],
  capabilities: ["inspect", "validate", "prepare"],
  async inspect({ entrypoint }) {
    const text = await readFile(entrypoint, "utf8");
    return { characters: text.length };
  },
  async validate({ entrypoint }) {
    const text = await readFile(entrypoint, "utf8");
    const valid = /^# Refund safety$/mu.test(text);
    return {
      valid,
      issues: valid ? [] : [{
        severity: "error",
        code: "EXPECTED_BEHAVIOR_TITLE",
        message: "The example Behavior must contain the expected title."
      }],
      summary: { characters: text.length }
    };
  },
  async prepare({ entrypoint }) {
    return {
      text: await readFile(entrypoint, "utf8"),
      supporting_files: []
    };
  }
};
