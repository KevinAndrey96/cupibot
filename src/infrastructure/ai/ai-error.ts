export class AiConsultationError extends Error {
  constructor(
    public readonly context: string,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`AI consultation failed during ${context}: ${detail}`);
    this.name = "AiConsultationError";
  }
}

export function isAiConsultationError(error: unknown): error is AiConsultationError {
  return error instanceof AiConsultationError
    || (error instanceof Error && error.name === "AiConsultationError");
}

export function isOllamaConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const causeMessage = error.cause instanceof Error
    ? error.cause.message.toLowerCase()
    : String(error.cause ?? "").toLowerCase();

  return message === "fetch failed"
    || message.includes("econnrefused")
    || message.includes("enotfound")
    || message.includes("network")
    || causeMessage.includes("econnrefused")
    || causeMessage.includes("fetch failed");
}

export function toAiFailure(error: unknown, context: string): AiConsultationError {
  if (isAiConsultationError(error)) {
    return error;
  }

  return new AiConsultationError(context, error);
}

export function formatAiFailure(error: unknown): {
  code: string;
  message: string;
  context?: string;
} {
  if (isAiConsultationError(error)) {
    return {
      code: "AiConsultationError",
      message: humanizeAiMessage(error.message, error.context),
      context: error.context,
    };
  }

  if (error instanceof Error) {
    return {
      code: "Error",
      message: humanizeAiMessage(error.message),
    };
  }

  return {
    code: "Error",
    message: String(error),
  };
}

function humanizeAiMessage(message: string, context?: string): string {
  if (!isOllamaConnectionError(new Error(message))) {
    return message;
  }

  const step = context ? ` (${context})` : "";

  return `no se pudo conectar con Ollama${step} - verifica que el servidor esté corriendo en OLLAMA_URL`;
}

export function logAiFailure(error: unknown): void {
  console.error("\n========================================");
  console.error("  SESSION STOPPED - AI UNAVAILABLE");
  console.error("========================================");

  const formatted = formatAiFailure(error);

  if (formatted.context) {
    console.error(`  Step:   ${formatted.context}`);
  }

  console.error(`  Reason: ${formatted.message}`);
  console.error("========================================\n");
}

export function exitOnAiFailure(error: unknown): never {
  logAiFailure(error);
  process.exit(1);
}
