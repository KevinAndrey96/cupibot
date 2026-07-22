export function parseOllamaHost(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  const host = parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname;
  const port = parsed.port || "11434";

  return `${host}:${port}`;
}

export function modelIsInstalled(model: string, installed: string[]): boolean {
  const normalized = model.toLowerCase();

  return installed.some((name) => {
    const lower = name.toLowerCase();

    return lower === normalized || lower.startsWith(`${normalized}:`);
  });
}
