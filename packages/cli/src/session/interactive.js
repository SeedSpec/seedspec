import { createInterface } from "node:readline";
import { formatError } from "@seedspec/runtime";
import { formatShellCommand } from "./commands.js";
import { parseInteractiveRequest } from "./tokenize.js";

export async function runInteractiveShell(session, options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const commandNames = session.commandNames();
  const completer = (line) => {
    const fragment = line.trimStart();
    const hits = commandNames.filter((name) => name.startsWith(fragment));
    return [hits.length ? hits : commandNames, fragment];
  };
  const terminal = options.terminal ?? Boolean(input.isTTY && output.isTTY);
  const prompt = options.prompt ?? "seedspec> ";
  const readline = createInterface({ input, output, completer, terminal, prompt });

  output.write(`SeedSpec shell — ${session.identity.name} (${session.identity.id}@${session.identity.version})\n`);
  output.write("Read-only session. Type help for commands.\n");
  if (terminal) readline.prompt();
  readline.on("SIGINT", () => {
    output.write("^C\n");
    if (terminal) readline.prompt();
  });

  for await (const line of readline) {
    try {
      const request = parseInteractiveRequest(line);
      if (!request) {
        if (terminal) readline.prompt();
        continue;
      }
      const result = await session.execute(request.command, request.args);
      output.write(`${formatShellCommand(request.command, result)}\n`);
      if (result.exit) {
        readline.close();
        break;
      }
    } catch (error) {
      output.write(`Error: ${formatError(error)}\n`);
    }
    if (terminal) readline.prompt();
  }
}
