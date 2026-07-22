const ROBOTIC_PATTERN = /^[A-ZÀ-Ú¡¿].{5,30}!\s.{10,60}\.\s.{5,40}\?\s*[😊😍🤩😉✨🤤😂🤣😅💀]?$/;

export interface ChatValidationConfig {
  bannedPhrases: string[];
  bannedEmojis: string[];
}

export function validateChatMessage(
  message: string,
  lastThemMessage: string,
  config: ChatValidationConfig,
): string[] {
  const violations: string[] = [];
  const lower = message.toLowerCase();

  for (const phrase of config.bannedPhrases) {
    if (lower.includes(phrase)) {
      violations.push(`banned phrase: "${phrase}"`);
    }
  }

  for (const emoji of config.bannedEmojis) {
    if (message.includes(emoji)) {
      violations.push(`banned emoji: ${emoji}`);
    }
  }

  if (ROBOTIC_PATTERN.test(message)) {
    violations.push("robotic pattern: [Reaction]! [Comment]. [Question]?");
  }

  const questionMarks = (message.match(/\?/g) ?? []).length;

  if (questionMarks >= 2) {
    violations.push("too many questions in one message");
  }

  if (message.length > 140) {
    violations.push("message too long for casual chat");
  }

  if (/^(qué|que|¡qué|!qué)\s+\w+[!,]/i.test(message.trim())) {
    violations.push("robotic opener: Qué/Que + adjective");
  }

  if (/^me (encanta|gusta|parece|interesa)/i.test(message.trim())) {
    violations.push("robotic opener: me encanta/gusta/parece");
  }

  if (lastThemMessage) {
    const themWords = lastThemMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const echoCount = themWords.filter((w) => lower.includes(w)).length;

    if (themWords.length > 0 && echoCount / themWords.length > 0.6) {
      violations.push("echoing her message");
    }
  }

  return violations;
}
