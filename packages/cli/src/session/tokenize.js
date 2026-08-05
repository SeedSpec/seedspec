import { SeedSpecError } from "@seedspec/runtime";

export function tokenizeShellLine(line) {
  const tokens = [];
  let value = "";
  let quote = null;
  let quoted = false;
  let escaping = false;

  function append() {
    if (value || quoted) tokens.push({ value, quoted });
    value = "";
    quoted = false;
  }

  for (const character of String(line)) {
    if (escaping) {
      value += character;
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else value += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      quoted = true;
      continue;
    }
    if (/\s/u.test(character)) append();
    else value += character;
  }

  if (escaping) throw new SeedSpecError("A trailing escape has no following character", { code: "INVALID_SHELL_SYNTAX" });
  if (quote) throw new SeedSpecError("A quoted value is not closed", { code: "INVALID_SHELL_SYNTAX" });
  append();
  return tokens;
}

function positionalArgs(command, tokens, count) {
  if (tokens.length !== count) {
    throw new SeedSpecError(`${command} expects ${count} argument${count === 1 ? "" : "s"}`, {
      code: "INVALID_SHELL_ARGUMENTS"
    });
  }
}

export function parseInteractiveRequest(line) {
  const [commandToken, ...tokens] = tokenizeShellLine(line.trim());
  if (!commandToken) return null;
  const command = commandToken.value === "quit" ? "exit" : commandToken.value;
  if (command === "search") {
    const args = {};
    const query = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (["--scope", "--role", "--limit"].includes(token.value)) {
        const next = tokens[index + 1];
        if (!next) {
          throw new SeedSpecError(`${token.value} requires a value`, { code: "INVALID_SHELL_ARGUMENTS" });
        }
        const name = token.value.slice(2);
        args[name] = name === "limit" ? Number(next.value) : next.value;
        index += 1;
      } else if (token.value.startsWith("--")) {
        throw new SeedSpecError(`Unknown search option: ${token.value}`, { code: "INVALID_SHELL_ARGUMENTS" });
      } else {
        query.push(token.quoted ? JSON.stringify(token.value) : token.value);
      }
    }
    args.query = query.join(" ");
    return { command, args };
  }
  if (command === "read") {
    positionalArgs(command, tokens, 1);
    return { command, args: { id: tokens[0].value } };
  }
  if (command === "docs") {
    if (tokens.length > 1) positionalArgs(command, tokens, 1);
    return { command, args: tokens[0] ? { scope: tokens[0].value } : {} };
  }
  positionalArgs(command, tokens, 0);
  return { command, args: {} };
}
