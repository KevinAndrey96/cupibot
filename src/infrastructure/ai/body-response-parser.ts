export function parseBodyTypeResponse(raw: string): "pass" | "fail" {
  const answer = raw.trim().toUpperCase();

  if (/\bFAIL\b/.test(answer)) {
    return "fail";
  }

  if (/\bPASS\b/.test(answer)) {
    return "pass";
  }

  return "pass";
}
