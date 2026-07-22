export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  ts: Date;
}

export type LogSink = (entry: LogEntry) => void;

const TAG_PREFIX_RE = /^\[([^\]]+)\]\s*(.*)$/s;

let activeSink: LogSink | null = null;
let mirrorToConsole = true;

type ConsoleMethod = typeof console.log;

let originalConsole: {
  log: ConsoleMethod;
  warn: ConsoleMethod;
  error: ConsoleMethod;
} | null = null;

let consoleBridged = false;

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === "string") {
    return arg;
  }

  if (arg instanceof Error) {
    return arg.message;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function parseConsoleLine(level: LogLevel, args: unknown[]): Pick<LogEntry, "level" | "tag" | "message"> {
  const combined = args.map(formatConsoleArg).join(" ").trim();
  const match = combined.match(TAG_PREFIX_RE);

  if (match) {
    return {
      level,
      tag: match[1],
      message: match[2] || combined,
    };
  }

  return {
    level,
    tag: "CupiBot",
    message: combined,
  };
}

function writeToConsole(level: LogLevel, line: string): void {
  const writer = originalConsole ?? console;

  if (level === "error") {
    writer.error(line);
  } else if (level === "warn") {
    writer.warn(line);
  } else {
    writer.log(line);
  }
}

function emitConsoleArgs(level: LogLevel, args: unknown[]): void {
  const parsed = parseConsoleLine(level, args);

  if (activeSink) {
    activeSink({
      ...parsed,
      ts: new Date(),
    });
  }

  if (originalConsole) {
    if (level === "error") {
      originalConsole.error(...args);
    } else if (level === "warn") {
      originalConsole.warn(...args);
    } else {
      originalConsole.log(...args);
    }
  }
}

function installConsoleBridge(): void {
  if (consoleBridged) {
    return;
  }

  originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => {
    emitConsoleArgs("info", args);
  };
  console.warn = (...args: unknown[]) => {
    emitConsoleArgs("warn", args);
  };
  console.error = (...args: unknown[]) => {
    emitConsoleArgs("error", args);
  };

  consoleBridged = true;
}

function removeConsoleBridge(): void {
  if (!consoleBridged || !originalConsole) {
    return;
  }

  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  originalConsole = null;
  consoleBridged = false;
}

export function setLogSink(sink: LogSink | null, mirror = true): void {
  activeSink = sink;
  mirrorToConsole = mirror;

  if (sink) {
    installConsoleBridge();
  } else {
    removeConsoleBridge();
  }
}

export function log(level: LogLevel, tag: string, message: string): void {
  const entry: LogEntry = { level, tag, message, ts: new Date() };

  if (activeSink) {
    activeSink(entry);
  }

  if (!mirrorToConsole && activeSink) {
    return;
  }

  writeToConsole(level, `[${tag}] ${message}`);
}

export function logInfo(tag: string, message: string): void {
  log("info", tag, message);
}

export function logWarn(tag: string, message: string): void {
  log("warn", tag, message);
}

export function logError(tag: string, message: string): void {
  log("error", tag, message);
}
