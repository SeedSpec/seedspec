import assert from "node:assert/strict";
import test from "node:test";
import { createPipelineBriefing } from "../src/pipeline-briefing.mjs";

test("exports the implementation factory", () => {
  assert.equal(typeof createPipelineBriefing, "function");
});

