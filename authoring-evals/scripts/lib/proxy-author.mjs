import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { sha256 } from "./run-contract.mjs";

function normalized(value) {
  return value.toLocaleLowerCase("en-US")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function phraseMatches(message, phrase) {
  const expected = normalized(phrase);
  if (message.includes(expected)) return true;
  const expectedTokens = expected.split(" ");
  let expectedIndex = 0;
  for (const token of message.split(" ")) {
    if (token === expectedTokens[expectedIndex]) expectedIndex += 1;
    if (expectedIndex === expectedTokens.length) return true;
  }
  return false;
}

function questionLike(message) {
  return message.includes("?") || /\b(?:please choose|should (?:the|we|i)|would you|do you want|which option|can you confirm)\b/iu.test(message);
}

export async function readFrozenSubject(runDirectory) {
  const source = await readFile(path.join(runDirectory, "control", "subject", "subject.yaml"), "utf8");
  return parseYaml(source);
}

export async function readProxyState(runDirectory, contractId) {
  const statePath = path.join(runDirectory, "control", "proxy-author-state.json");
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    if (state.contract_id !== contractId || state.authoring_eval_proxy_state_version !== "1") {
      throw new Error("Proxy-author state does not match the frozen run contract");
    }
    return state;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return {
      authoring_eval_proxy_state_version: "1",
      contract_id: contractId,
      answered: [],
      repeated: [],
      unmatched: []
    };
  }
}

export function classifyProxyMessage(subject, message, proxyState) {
  const clean = normalized(message);
  const answeredIds = new Set(proxyState.answered.map(({ decision_id: decisionId }) => decisionId));
  const matches = subject.proxy_author.decisions.filter((decision) => (
    decision.match.any.some((phrase) => phraseMatches(clean, phrase))
  ));
  const unanswered = matches.filter(({ id }) => !answeredIds.has(id));
  const answered = matches.filter(({ id }) => answeredIds.has(id));
  if (!questionLike(message)) {
    return { status: "no-question", matches: matches.map(({ id }) => id) };
  }
  if (unanswered.length === 1) {
    return { status: "answer", decision: unanswered[0] };
  }
  if (unanswered.length > 1) {
    return { status: "ambiguous-question", matches: unanswered.map(({ id }) => id) };
  }
  if (answered.length === 1) {
    const prior = proxyState.answered.find(({ decision_id: decisionId }) => decisionId === answered[0].id);
    return { status: "repeated-question", decision: answered[0], prior };
  }
  if (answered.length > 1) {
    return { status: "ambiguous-repeat", matches: answered.map(({ id }) => id) };
  }
  return { status: "unexpected-question", matches: [] };
}

export async function recordProxyOutcome(runDirectory, state, outcome) {
  const next = structuredClone(state);
  if (outcome.kind === "answered") {
    next.answered.push({
      turn: outcome.turn,
      decision_id: outcome.decision.id,
      question_digest: sha256(outcome.message),
      answer_digest: sha256(outcome.decision.answer)
    });
  } else if (outcome.kind === "repeated") {
    next.repeated.push({
      turn: outcome.turn,
      decision_id: outcome.decision.id,
      question_digest: sha256(outcome.message)
    });
  } else {
    next.unmatched.push({
      turn: outcome.turn,
      classification: outcome.classification,
      message_digest: sha256(outcome.message)
    });
  }
  await writeFile(
    path.join(runDirectory, "control", "proxy-author-state.json"),
    `${JSON.stringify(next, null, 2)}\n`,
    { encoding: "utf8", flag: "w" }
  );
  return next;
}
