import type { ChatMessage } from "../../domain/types.js";

export interface RawDomMessage {
  sender: "me" | "them";
  content: string;
  timeLabel: string | null;
}

/** Self-contained function injected into page.evaluate - do not reference outer scope. */
export const EXTRACT_TIME_LABEL_SCRIPT = `
function extractTimeLabel(bubble) {
  var timeRe = /^\\d{1,2}:\\d{2}(\\s*(AM|PM))?$/i;
  var sentAtRe = /^Sent at \\d/i;
  var dayRe = /^(today|yesterday|hoje|ontem|hoy|ayer)$/i;

  function isTimeText(text) {
    return timeRe.test(text) || sentAtRe.test(text) || dayRe.test(text);
  }

  var timeEl = bubble.querySelector("time[datetime]");
  if (timeEl) {
    var datetime = timeEl.getAttribute("datetime");
    if (datetime) return datetime;
    var timeText = (timeEl.textContent || "").trim();
    if (timeText) return timeText;
  }

  var node = bubble;
  for (var depth = 0; depth < 6 && node; depth++) {
    var parent = node.parentElement;
    if (!parent) break;

    var allInParent = parent.querySelectorAll("span, p, time");
    var bubbleRect = bubble.getBoundingClientRect();
    var closest = null;
    var closestDist = Infinity;

    for (var i = 0; i < allInParent.length; i++) {
      var span = allInParent[i];
      if (span.childElementCount > 0) continue;

      var label = (span.innerText || span.textContent || "").trim();
      if (!isTimeText(label)) continue;

      var rect = span.getBoundingClientRect();
      var dist = Math.abs(rect.top - bubbleRect.bottom);
      if (dist < closestDist) {
        closestDist = dist;
        closest = label;
      }
    }

    if (closest) return closest;

    node = parent;
  }

  return null;
}
`.trim();

export function wrapDomEvaluateScript(body: string): string {
  return `(() => {
${EXTRACT_TIME_LABEL_SCRIPT}
return (() => {
${body}
})();
})()`;
}

const DAY_OFFSET: Record<string, number> = {
  today: 0,
  hoy: 0,
  hoje: 0,
  yesterday: -1,
  ayer: -1,
  ontem: -1,
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);

  return copy;
}

function applyClockTime(base: Date, hours: number, minutes: number): Date {
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);

  return result;
}

export function parseChatTimestamp(
  label: string | null | undefined,
  reference: Date,
): Date {
  if (!label?.trim()) {
    return new Date(reference);
  }

  const trimmed = label.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = Date.parse(trimmed);

    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  const lower = trimmed.toLowerCase();
  const dayOffset = DAY_OFFSET[lower];

  if (dayOffset !== undefined && !/\d{1,2}:\d{2}/.test(trimmed)) {
    const result = startOfDay(reference);
    result.setDate(result.getDate() + dayOffset);
    result.setHours(12, 0, 0, 0);

    return result;
  }

  const sentAtMatch = trimmed.match(
    /sent at\s+(\d{1,2}:\d{2}(\s*(AM|PM))?)/i,
  );
  const clockSource = sentAtMatch?.[1] ?? trimmed;
  const clockMatch = clockSource.match(/^(\d{1,2}):(\d{2})(\s*(AM|PM))?$/i);

  if (!clockMatch) {
    return new Date(reference);
  }

  let hours = Number.parseInt(clockMatch[1], 10);
  const minutes = Number.parseInt(clockMatch[2], 10);
  const ampm = clockMatch[4]?.toUpperCase();

  if (ampm === "PM" && hours < 12) {
    hours += 12;
  }

  if (ampm === "AM" && hours === 12) {
    hours = 0;
  }

  const offset =
    dayOffset ??
    (DAY_OFFSET[lower.split(/\s+/)[0] ?? ""] ?? 0);

  const base = startOfDay(reference);
  base.setDate(base.getDate() + offset);

  const result = applyClockTime(base, hours, minutes);

  if (dayOffset === undefined && !sentAtMatch && result > reference) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}

export function mapRawDomMessages(
  raw: RawDomMessage[],
  reference = new Date(),
): ChatMessage[] {
  let previous = new Date(reference);

  return raw.map((message) => {
    const timestamp = parseChatTimestamp(message.timeLabel, previous);

    if (!message.timeLabel) {
      previous = new Date(Math.max(timestamp.getTime(), previous.getTime()));

      return {
        sender: message.sender,
        content: message.content,
        timestamp: previous,
      };
    }

    previous = timestamp;

    return {
      sender: message.sender,
      content: message.content,
      timestamp,
    };
  });
}
