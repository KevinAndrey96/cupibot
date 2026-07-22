function normalizeReason(raw: string | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }

  return raw.trim().replace(/\s+/g, " ");
}

function validScore(value: number): number | null {
  if (value >= 1 && value <= 10) {
    return value;
  }

  return null;
}

export function parseScoringResponse(raw: string): {
  score: number | null;
  reason: string | null;
} {
  const cleaned = raw.trim();

  if (!cleaned) {
    return { score: null, reason: null };
  }

  const scoreInlineMatch = cleaned.match(/SCORE:\s*(\d{1,2})\s*:\s*(.+)/is);

  if (scoreInlineMatch?.[1]) {
    const score = validScore(Number.parseInt(scoreInlineMatch[1], 10));

    return {
      score,
      reason: normalizeReason(scoreInlineMatch[2]),
    };
  }

  const scoreLabelMatch = cleaned.match(/SCORE:\s*(\d{1,2})/i);

  if (scoreLabelMatch?.[1]) {
    const score = validScore(Number.parseInt(scoreLabelMatch[1], 10));
    const reasonMatch = cleaned.match(/reason:\s*(.+)/is);

    return {
      score,
      reason: normalizeReason(reasonMatch?.[1]),
    };
  }

  const colonMatch = cleaned.match(/^(\d{1,2})\s*:\s*(.+)$/is);

  if (colonMatch?.[1]) {
    const score = validScore(Number.parseInt(colonMatch[1], 10));

    return {
      score,
      reason: normalizeReason(colonMatch[2]),
    };
  }

  const leadingNumber = cleaned.match(/^(\d{1,2})\b/);

  if (leadingNumber?.[1]) {
    const score = validScore(Number.parseInt(leadingNumber[1], 10));

    return {
      score,
      reason: normalizeReason(cleaned.slice(leadingNumber[0].length)),
    };
  }

  const wordScoreMatch = cleaned.match(/SCORE:\s*([a-z]+)/i);

  if (wordScoreMatch?.[1]) {
    const score = wordScoreToNumber(wordScoreMatch[1]);

    if (score !== null) {
      return {
        score,
        reason: normalizeReason(wordScoreMatch[1]),
      };
    }
  }

  return { score: null, reason: null };
}

const WORD_SCORES: Record<string, number> = {
  poor: 3,
  bad: 2,
  below: 4,
  mediocre: 4,
  average: 5,
  decent: 6,
  good: 7,
  great: 8,
  excellent: 9,
  exceptional: 10,
};

function wordScoreToNumber(word: string): number | null {
  const score = WORD_SCORES[word.toLowerCase()];

  return score ?? null;
}
