# Write your first SeedSpec

You need Node.js 20 or newer and an AI agent you already use — Claude Code,
Codex, or anything else that can run a command and read its output. You do not
need to install SeedSpec, learn YAML, or understand the protocol.

This takes about fifteen minutes.

## 1. Start a package

```bash
npx @seedspec/cli init application --output my-package
cd my-package
```

That creates five files. Two of them matter to you:

- **`seed.md`** — what you are making. This is the part only you can write.
- **`success.md`** — how someone would know it works.

The rest (`seedspec.yaml`, `configuration/`) is bookkeeping the tools maintain.

Other kinds are available when "application" is wrong: `feature` for behavior
added to something that already exists, `component` for a bounded reusable
part, and `workflow` for a process spanning systems. The remaining hints are
`automation`, `configuration`, `integration`, and `solution`. The kind is a
hint for tools, not a commitment.

## 2. Write a rough seed

Open `seed.md` and describe what you want to exist. Write it the way you would
explain it to a colleague. Do not try to be complete, and do not write
requirements.

A real starting point looks like this:

```markdown
# Neighborhood Tool Library

A way for neighbors to lend tools to each other without deposits or fees.

Someone lists a tool they own. A neighbor asks to borrow it. The owner
approves, they arrange handoff themselves, and the tool comes back.

Only people in the same building can see each other's tools.
```

That is enough. Three short paragraphs with a real boundary in them is a better
seed than two pages of invented requirements.

## 3. Bring in an agent

```bash
npx @seedspec/cli author prompt
```

Paste what it prints into your agent. It will run `author review` and get a
complete brief — you do not need to explain SeedSpec to it.

Then just talk. The agent opens by reflecting back what it thinks you are
making and asking whether that is right. Correct it. When it raises something,
answer in your own words.

**What good looks like:** the agent asks you one thing at a time and waits.
Questions like "when a tool is already lent out and someone else asks for it,
what should happen?" are the point of this — that is a decision only you can
make, and making it now means an implementing agent won't invent an answer
later.

**What to push back on:** if the agent starts adding features you never
mentioned, tell it to stop. The system is built to refuse that, and a seed that
grows a payment system you never asked for is a broken conversation, not a
better spec.

Nothing changes without your say-so. The agent shows you exact wording and
waits for you to accept it.

## 4. Say what success looks like

Open `success.md` and replace the placeholder with results someone could
actually observe:

```markdown
1. A resident can list a tool and see it appear for their building.
2. A neighbor in the same building can request it; someone in another
   building cannot see it at all.
3. The owner can approve or decline, and both people can see the current state.
4. A returned tool becomes available again.
```

Observable results, not tests. Your agent can help — it will keep this aligned
with the seed rather than inventing new criteria.

## 5. Check and share it

```bash
npx @seedspec/cli author check
```

This tells you whether the package is structurally sound and whether anything
is still unresolved. When you are ready:

```bash
npx @seedspec/cli author pack
```

That produces a versioned archive. Anyone can hand it to their own agent with
`npx @seedspec/cli begin <path>` and get your intent, your decisions, and your
success criteria — not a summary of them.

## What you are not doing

- **Not writing requirements.** A seed is a starting point that grows into a
  particular result, not a contract that pins one down.
- **Not designing the implementation.** Stack, architecture, and hosting belong
  to whoever builds it.
- **Not aiming for complete.** Reviewing an area and deciding it is fine as-is
  is a real, recorded outcome. So is deciding it does not apply.

## When it goes wrong

Errors and how to clear them are in
[authoring errors](authoring-errors.md). Two common ones:

- **"No SeedSpec authoring project was found here"** — you are in the wrong
  directory. Discovery looks at the current directory and its parents, never
  subdirectories, so `cd` into the package.
- **The agent narrates its process instead of talking to you** — tell it to
  re-read the brief with `seedspec author review`. That behavior is what the
  brief exists to prevent.

## Next

- [Authoring guide](authoring.md) — the full workflow, review threads, and
  coaching depths.
- [Worked example](worked-example.md) — a weak seed becoming a strong one,
  including the questions that did the work.
- [Kind-aware authoring](kind-guidance.md) — choosing between application,
  feature, workflow, and the rest.
