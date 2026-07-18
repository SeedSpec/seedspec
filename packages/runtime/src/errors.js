export class SeedSpecError extends Error {
  constructor(message, { code = "SEEDSPEC_ERROR", details = [] } = {}) {
    super(message);
    this.name = "SeedSpecError";
    this.code = code;
    this.details = details;
  }
}

export function formatError(error) {
  if (!(error instanceof SeedSpecError)) {
    return error.message;
  }

  const message = `[${error.code}] ${error.message}`;
  if (error.details.length === 0) return message;

  return `${message}\n${error.details.map((detail) => `  - ${detail}`).join("\n")}`;
}
