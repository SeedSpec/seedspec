import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillsRoot = fileURLToPath(new URL("../skills/", import.meta.url));

async function describeSkill(id) {
  const source = await readFile(path.join(skillsRoot, id, "SKILL.md"), "utf8");
  const name = source.match(/^name:\s*(.+)$/mu)?.[1]?.trim() ?? id;
  const description = source.match(/^description:\s*(.+)$/mu)?.[1]?.trim() ?? "";
  return { id, name, description };
}

export async function listBundledSkills() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort()
    .map(describeSkill));
}

export async function exportBundledSkills(outputDirectory, { skill } = {}) {
  const available = await listBundledSkills();
  const selected = skill
    ? available.filter(({ id }) => id === skill)
    : available;
  if (skill && selected.length === 0) {
    throw new Error(`Unknown bundled skill: ${skill}`);
  }
  const output = path.resolve(outputDirectory);
  await mkdir(output, { recursive: true });
  const exported = [];
  for (const item of selected) {
    const target = path.join(output, item.id);
    await cp(path.join(skillsRoot, item.id), target, {
      recursive: true,
      force: false,
      errorOnExist: true
    });
    exported.push({ ...item, path: target });
  }
  return { output, skills: exported };
}

export function formatBundledSkills(result) {
  if (Array.isArray(result)) {
    return [
      "Bundled SeedSpec skills:",
      ...result.map(({ id, description }) => `- ${id}${description ? ` — ${description}` : ""}`)
    ].join("\n");
  }
  return [
    `Exported ${result.skills.length} SeedSpec skill(s) to ${result.output}`,
    ...result.skills.map(({ id, path: target }) => `- ${id}: ${target}`)
  ].join("\n");
}
