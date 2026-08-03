import { once } from "node:events";
import { createInterface } from "node:readline";

function errorResult(error) {
  return {
    code: error.code ?? "SHELL_COMMAND_FAILED",
    message: error.message ?? String(error),
    details: error.details ?? []
  };
}

async function writeResponse(output, response) {
  if (!output.write(`${JSON.stringify(response)}\n`)) await once(output, "drain");
}

function parseRequest(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    const error = new Error("Input line is not valid JSON");
    error.code = "INVALID_JSONL_REQUEST";
    throw error;
  }
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    const error = new Error("JSONL request must be an object");
    error.code = "INVALID_JSONL_REQUEST";
    throw error;
  }
  if (!(typeof request.id === "string" || typeof request.id === "number")) {
    const error = new Error("JSONL request id must be a string or number");
    error.code = "INVALID_JSONL_REQUEST";
    throw error;
  }
  if (typeof request.command !== "string" || !request.command) {
    const error = new Error("JSONL request command must be a non-empty string");
    error.code = "INVALID_JSONL_REQUEST";
    error.requestId = request.id;
    throw error;
  }
  return { id: request.id, command: request.command, args: request.args ?? {} };
}

export async function runJsonlShell(session, options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const readline = createInterface({ input, crlfDelay: Infinity, terminal: false });
  for await (const line of readline) {
    if (!line.trim()) continue;
    let request;
    try {
      request = parseRequest(line);
      const result = await session.execute(request.command, request.args);
      await writeResponse(output, { id: request.id, ok: true, result });
      if (result.exit) break;
    } catch (error) {
      await writeResponse(output, {
        id: request?.id ?? error.requestId ?? null,
        ok: false,
        error: errorResult(error)
      });
    }
  }
  readline.close();
}
