import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { protocolSchemaNames, schemaDirectory } from "@seedspec/protocol";

const MAX_UNTRUSTED_PATTERN_LENGTH = 512;

// Packages supply their own JSON Schemas, so their regexes run against
// attacker-chosen input inside offline validation. This scanner rejects the
// exponential-backtracking family (a repeated group whose branch begins with a
// quantified atom, e.g. (a+)+) while allowing the common anchored shapes such
// as ^[a-z0-9]+(?:-[a-z0-9]+)*$. Ambiguous alternation like (a|a)+ is not
// statically detected; the length cap bounds what it can express.
function unsafePatternReason(pattern) {
  if (pattern.length > MAX_UNTRUSTED_PATTERN_LENGTH) {
    return `is longer than ${MAX_UNTRUSTED_PATTERN_LENGTH} characters`;
  }
  const frames = [{ atoms: 0, leading: false, childLeading: false }];
  let inCharacterClass = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "\\") {
      const next = pattern[index + 1] ?? "";
      if (!inCharacterClass && ((next >= "1" && next <= "9") || next === "k")) {
        return "contains a backreference";
      }
      if (!inCharacterClass) frames[frames.length - 1].atoms += 1;
      index += 1;
      continue;
    }
    if (inCharacterClass) {
      if (character === "]") {
        inCharacterClass = false;
        frames[frames.length - 1].atoms += 1;
      }
      continue;
    }
    if (character === "[") {
      inCharacterClass = true;
      continue;
    }
    if (character === "(") {
      frames.push({ atoms: 0, leading: false, childLeading: false });
      continue;
    }
    if (character === ")") {
      const frame = frames.length > 1
        ? frames.pop()
        : { atoms: 0, leading: false, childLeading: false };
      const explosive = frame.leading || (frame.childLeading && frame.atoms === 1);
      const next = pattern[index + 1] ?? "";
      const repeats = next === "*" || next === "+"
        || (next === "{" && /^\d$/u.test(pattern[index + 2] ?? ""));
      if (repeats && explosive) {
        return "repeats a group whose content is itself an unanchored repetition";
      }
      const parent = frames[frames.length - 1];
      parent.atoms += 1;
      if (explosive && parent.atoms === 1) parent.childLeading = true;
      continue;
    }
    if (character === "|") {
      frames[frames.length - 1].atoms = 0;
      continue;
    }
    const isQuantifier = character === "*" || character === "+"
      || (character === "{" && /^\d$/u.test(pattern[index + 1] ?? ""))
      || (character === "?" && pattern[index - 1] !== "(");
    if (isQuantifier) {
      const frame = frames[frames.length - 1];
      if (frame.atoms <= 1) frame.leading = true;
      continue;
    }
    frames[frames.length - 1].atoms += 1;
  }
  return null;
}

function compileUntrustedRegExp(pattern, flags) {
  const reason = unsafePatternReason(pattern);
  if (reason) {
    throw new Error(`Pattern ${reason}: ${pattern}`);
  }
  return new RegExp(pattern, flags);
}

let protocolCompilationPromise = null;

async function protocolCompilation() {
  protocolCompilationPromise ??= (async () => {
    // strictSchema rejects typo'd keywords in the protocol's own schemas.
    // strictRequired and strictTypes stay off: the release schemas use the
    // standard {"not": {"required": [...]}} exclusion idiom and implied
    // object types that those checks would flag.
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      strictRequired: false,
      strictTypes: false
    });
    addFormats(ajv);
    const schemas = await Promise.all(protocolSchemaNames.map(loadProtocolSchema));
    for (const schema of schemas) ajv.addSchema(schema);
    return { ajv, schemas };
  })();
  return protocolCompilationPromise;
}

export async function loadProtocolSchema(name) {
  return JSON.parse(await readFile(path.join(schemaDirectory, name), "utf8"));
}

export async function compileProtocolSchema(name) {
  const { ajv, schemas } = await protocolCompilation();
  const selected = schemas[protocolSchemaNames.indexOf(name)];
  if (!selected) throw new Error(`Unknown protocol schema: ${name}`);
  return ajv.getSchema(selected.$id);
}

export function compileConfigurationSchema(schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    code: { regExp: compileUntrustedRegExp }
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function formatSchemaErrors(errors) {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    const extra = error.params?.additionalProperty
      ? ` (${error.params.additionalProperty})`
      : "";
    return `${location} ${error.message}${extra}`;
  });
}
