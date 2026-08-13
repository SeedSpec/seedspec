import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const workspace = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: evaluate.mjs <workspace>");

const checks = [];
async function check(id, description, operation) {
  try {
    await operation();
    checks.push({ id, description, passed: true });
  } catch (error) {
    checks.push({
      id,
      description,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

let createPipelineBriefing;
try {
  const moduleUrl = pathToFileURL(path.join(workspace, "src/pipeline-briefing.mjs"));
  ({ createPipelineBriefing } = await import(`${moduleUrl.href}?eval=${Date.now()}`));
} catch (error) {
  checks.push({
    id: "load",
    description: "implementation module loads",
    passed: false,
    error: error instanceof Error ? error.message : String(error)
  });
}

function fixture({ noData = false, link = null, sendFailures = 0, conflict = null } = {}) {
  const resources = new Map();
  if (conflict) resources.set(`${conflict.kind}:${conflict.identity}`, conflict);
  const creations = [];
  const queries = [];
  const sends = [];
  const failures = [];
  const delivered = new Set();
  let remainingSendFailures = sendFailures;
  const dependencies = {
    clock: { now: () => new Date("2026-03-09T13:00:00.000Z") },
    resources: {
      async find(kind, identity) {
        return resources.get(`${kind}:${identity}`) ?? null;
      },
      async create(kind, identity, definition) {
        const key = `${kind}:${identity}`;
        if (resources.has(key)) throw new Error(`duplicate resource: ${key}`);
        const resource = { kind, identity, definition };
        resources.set(key, resource);
        creations.push(resource);
        return resource;
      }
    },
    hubspot: {
      async qualifiedPipelineValue(query) {
        queries.push(query);
        return noData ? { status: "no-data" } : { status: "value", value: 125000 };
      },
      async dashboardLink() {
        return link;
      }
    },
    slack: {
      async hasMessage(idempotencyKey) {
        return delivered.has(idempotencyKey);
      },
      async send(message) {
        if (remainingSendFailures > 0) {
          remainingSendFailures -= 1;
          throw new Error("Slack failure xoxb-fixture-secret");
        }
        sends.push(message);
        delivered.add(message.idempotencyKey);
        return { id: `message-${sends.length}` };
      }
    },
    operations: {
      async recordFailure(record) {
        failures.push(record);
      }
    }
  };
  return { dependencies, resources, creations, queries, sends, failures };
}

function factory(state) {
  assert.equal(typeof createPipelineBriefing, "function");
  const result = createPipelineBriefing(state.dependencies);
  assert.equal(typeof result?.setup, "function");
  assert.equal(typeof result?.deliver, "function");
  return result;
}

function hasKind(resource, expected) {
  const tokens = String(resource.kind).toLowerCase().split(/[^a-z]+/u).filter(Boolean);
  return tokens.includes(expected);
}

if (createPipelineBriefing) {
  await check("contract", "factory exposes setup and deliver", async () => {
    factory(fixture());
  });

  const setupState = fixture();
  const setupAdapter = factory(setupState);
  await check("setup-resources", "setup provisions the required resource kinds", async () => {
    await setupAdapter.setup();
    for (const kind of ["property", "report", "dashboard", "schedule"]) {
      assert.ok(setupState.creations.some((resource) => hasKind(resource, kind)), `missing ${kind}`);
    }
    const serialized = JSON.stringify(setupState.creations).toLowerCase();
    for (const value of [
      "daily qualified pipeline",
      "qualified_pipeline_value",
      "deal",
      "america/chicago",
      "08:00",
      "#sales-daily"
    ]) assert.ok(serialized.includes(value), `setup omits ${value}`);
  });
  await check("setup-idempotency", "a setup retry creates no duplicate resources", async () => {
    const count = setupState.creations.length;
    await setupAdapter.setup();
    assert.equal(setupState.creations.length, count);
  });

  const valueState = fixture({
    link: { url: "https://hubspot.example/dashboard/daily", stable: true, authorized: true }
  });
  const valueAdapter = factory(valueState);
  await check("reporting-query", "delivery queries the previous Chicago calendar day", async () => {
    await valueAdapter.deliver();
    assert.equal(valueState.queries.length, 1);
    assert.equal(valueState.queries[0].object, "deal");
    assert.equal(valueState.queries[0].property, "qualified_pipeline_value");
    assert.equal(valueState.queries[0].date, "2026-03-08");
    assert.equal(valueState.queries[0].timezone, "America/Chicago");
  });
  await check("value-message", "value delivery includes required meaning and an allowed link", async () => {
    assert.equal(valueState.sends.length, 1);
    const message = valueState.sends[0];
    assert.equal(message.channel, "#sales-daily");
    assert.ok(message.idempotencyKey);
    const text = message.text.toLowerCase();
    assert.match(text, /qualified[_ -]pipeline/);
    assert.ok(text.includes("2026-03-08"));
    assert.match(text, /125[,.]?000/);
    assert.ok(text.includes("america/chicago"));
    assert.ok(text.includes("https://hubspot.example/dashboard/daily"));
  });
  await check("message-idempotency", "a delivery retry sends no duplicate message", async () => {
    await valueAdapter.deliver();
    assert.equal(valueState.sends.length, 1);
  });

  await check("unsafe-link", "unstable or unauthorized dashboard links are excluded", async () => {
    for (const link of [
      { url: "https://hubspot.example/unstable", stable: false, authorized: true },
      { url: "https://hubspot.example/unauthorized", stable: true, authorized: false }
    ]) {
      const state = fixture({ link });
      await factory(state).deliver();
      assert.equal(state.sends.length, 1);
      assert.ok(!state.sends[0].text.includes(link.url));
    }
  });

  await check("no-data", "an empty day sends an explicit no-data message, not zero", async () => {
    const state = fixture({ noData: true });
    await factory(state).deliver();
    assert.equal(state.sends.length, 1);
    const text = state.sends[0].text.toLowerCase();
    assert.match(text, /no[ -]data|data (?:is )?unavailable|no qualified/);
    assert.ok(text.includes("2026-03-08"));
    assert.ok(!/(?:\$|value[^\n]*)0(?:\.00)?\b/u.test(text));
  });

  await check("visible-retry", "delivery failure is recorded, secret-safe, and retryable", async () => {
    const state = fixture({ sendFailures: 1 });
    const adapter = factory(state);
    try {
      await adapter.deliver();
    } catch {
      // Throwing after recording is an acceptable failure signal.
    }
    assert.equal(state.failures.length, 1);
    assert.ok(!JSON.stringify(state.failures).includes("xoxb-fixture-secret"));
    await adapter.deliver();
    assert.equal(state.sends.length, 1);
  });

  await check("conflict-safety", "a conflicting existing property is not reused or overwritten", async () => {
    const initial = fixture();
    const probe = factory(initial);
    await probe.setup();
    const property = initial.creations.find((resource) => hasKind(resource, "property"));
    assert.ok(property, "setup did not expose a property identity");
    const state = fixture({
      conflict: {
        kind: property.kind,
        identity: property.identity,
        definition: { ownership: "other-team", businessMeaning: "unrelated revenue" }
      }
    });
    let stopped = false;
    try {
      const result = await factory(state).setup();
      stopped = result?.status === "blocked" || result?.status === "needs-direction";
    } catch {
      stopped = true;
    }
    assert.ok(stopped, "setup silently reused a conflicting property");
    assert.ok(!state.creations.some((resource) => resource.kind === property.kind));
  });
}

const passed = checks.filter((item) => item.passed).length;
const result = {
  implementation_eval_version: "1",
  passed,
  total: checks.length,
  pass_rate: checks.length === 0 ? 0 : passed / checks.length,
  checks
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
