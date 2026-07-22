export type GenderLabel = "female" | "male" | "trans";

const GENDER_LABEL_PATTERN = /\b(FEMALE|MALE|TRANS)\b/i;

export function parseGenderResponse(
  raw: string,
  rejectLabels: readonly string[],
): GenderLabel {
  const answer = raw.trim().toUpperCase();
  const match = GENDER_LABEL_PATTERN.exec(answer);

  if (match?.[1]) {
    const label = match[1].toUpperCase();

    if (label === "FEMALE") {
      return "female";
    }

    if (rejectLabels.some((reject) => reject.toUpperCase() === label)) {
      return label.toLowerCase() as "male" | "trans";
    }
  }

  for (const reject of rejectLabels) {
    const pattern = new RegExp(`\\b${reject}\\b`, "i");

    if (pattern.test(answer)) {
      return reject.toLowerCase() as "male" | "trans";
    }
  }

  if (/\bFEMALE\b/i.test(answer)) {
    return "female";
  }

  return "male";
}
