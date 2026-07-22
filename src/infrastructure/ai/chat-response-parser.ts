const UNKNOWN_Q_PATTERN = /\bUNKNOWN_Q:\s*"?(.+?)"?\s*$/;

export function parseChatResponse(
  raw: string,
  personaName: string,
  instagramHandle: string,
): {
  message: string;
  unknownQuestions: string[];
} {
  const lines = raw.trim().split("\n");
  const messageLines: string[] = [];
  const unknownQuestions: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const match = UNKNOWN_Q_PATTERN.exec(trimmed);

    if (match) {
      unknownQuestions.push(match[1]);
      const cleaned = trimmed.replace(UNKNOWN_Q_PATTERN, "").trim();

      if (cleaned) {
        messageLines.push(cleaned);
      }

      continue;
    }

    messageLines.push(trimmed);
  }

  let message = messageLines.join(" ").trim();

  if (
    (message.startsWith('"') && message.endsWith('"')) ||
    (message.startsWith("'") && message.endsWith("'"))
  ) {
    message = message.substring(1, message.length - 1).trim();
  }

  const labelPattern = new RegExp(`^(${personaName}|Me|Eu):\\s*`, "i");
  message = message.replace(labelPattern, "");
  message = message.replace(/\s*\bUNKNOWN_Q:\s*"?[^"]*"?\s*/gi, " ").trim();
  message = message.replace(/¿/g, "").replace(/¡/g, "").trim();

  const handlePattern = new RegExp(
    `@?${instagramHandle.replace("@", "")}`,
    "gi",
  );
  message = message.replace(handlePattern, instagramHandle);

  return { message, unknownQuestions };
}
