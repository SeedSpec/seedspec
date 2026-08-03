# Read-only SeedSpec shell

The shell keeps one validated SeedSpec package active for a terminal or agent.
It retains package identity, deterministic search state, prior results, and
process-local command history.

The shell does not edit, resolve, activate, or execute package content. It does
not load implementation-resource bodies or unprepared supporting context.

## Start an interactive session

1. Start the shell with one package source.

   ```bash
   seedspec shell <package-path-or-github-url>
   ```

2. Enter `help` to list commands.

3. Enter a search query.

   ```text
   search "offline conflict" --scope package --limit 5
   ```

4. Enter `read` with a returned result ID.

   ```text
   read #a19c34ef
   ```

5. Enter `exit` to close the session.

`repl` is an alias for `shell`.

## Commands

```text
status
begin
validate
inspect
lint
digest
artifacts
resources
docs [protocol|implementing]
search <query> [--scope <scope>] [--role <role>] [--limit <count>]
read <result-id>
reload
history
describe
help
exit
```

Search uses a deterministic in-memory lexical index. Quoted text requires an
exact phrase. Scope and role filters use the metadata shown in each result.
Relevance does not change source authority.

`reload` validates changed local bytes before it replaces the active package.
A failed reload keeps the prior valid package and corpus active.

Command history does not persist after the process exits.

## Use the agent stream

1. Start the shell in JSONL mode.

   ```bash
   seedspec shell <package-path-or-github-url> --jsonl
   ```

2. Send one JSON object per line.

   ```json
   {"id":"1","command":"search","args":{"query":"offline conflict","limit":5}}
   ```

3. Read one response with the same ID.

   ```json
   {"id":"1","ok":true,"result":{"matches":[]}}
   ```

4. Send `describe` to inspect command argument shapes.

5. Send `exit` to close the session.

JSONL mode writes no prompt, color, or unsolicited prose. A recoverable command
error returns a structured response and keeps the session open.

## Indexed material

The initial corpus contains:

- primary intent;
- declared Markdown components;
- configuration guidance;
- capability contracts;
- implementation-profile guidance;
- bundled composition integration documents;
- exact-release protocol documents;
- the version-matched implementing guide; and
- declared artifact, context-module, and implementation-resource summaries.

The corpus excludes arbitrary files, remote bodies, full implementation
resources, and unprepared supporting context bodies.
