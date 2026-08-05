import {
  SeedSpecError,
  buildSearchCorpus,
  validatePackage
} from "@seedspec/runtime";
import { createShellCommandRegistry } from "./commands.js";

export async function createShellSession(packagePath, options = {}) {
  const registry = createShellCommandRegistry();
  const state = {
    packagePath,
    source: options.source ?? packagePath,
    implementingGuide: options.implementingGuide ?? null,
    record: null,
    corpus: null,
    availableResults: new Set(),
    history: [],
    identity() {
      return {
        id: this.record.manifest.id,
        name: this.record.manifest.name,
        kind: this.record.manifest.kind,
        version: this.record.manifest.version,
        protocol_version: this.record.manifest.protocol_version,
        digest: this.record.digest
      };
    },
    async reload() {
      const record = await validatePackage(this.packagePath);
      const corpus = await buildSearchCorpus(record, {
        implementingGuide: this.implementingGuide
      });
      this.record = record;
      this.corpus = corpus;
      this.availableResults.clear();
      return {
        package: this.identity(),
        corpus: {
          sources: corpus.source_count,
          sections: corpus.section_count
        }
      };
    }
  };
  await state.reload();

  return {
    get identity() {
      return state.identity();
    },
    commandNames() {
      return [...registry.keys()];
    },
    async execute(command, args = {}) {
      const definition = registry.get(command);
      if (!definition) {
        throw new SeedSpecError(`Unknown shell command: ${command}`, {
          code: "UNKNOWN_SHELL_COMMAND"
        });
      }
      try {
        const result = await definition.execute(state, args);
        state.history.push({
          sequence: state.history.length + 1,
          command,
          args: structuredClone(args),
          ok: true
        });
        return result;
      } catch (error) {
        state.history.push({
          sequence: state.history.length + 1,
          command,
          args: structuredClone(args),
          ok: false,
          error: error.code ?? "SHELL_COMMAND_FAILED"
        });
        throw error;
      }
    }
  };
}
