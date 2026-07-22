const handlers: Array<() => void> = [];
let installed = false;

export function registerShutdownHandler(handler: () => void): void {
  handlers.push(handler);

  if (installed) {
    return;
  }

  installed = true;

  process.once("SIGINT", () => {
    console.log("\n[CupiBot] interrupt received, stopping gracefully...");

    for (const handlerFn of handlers) {
      try {
        handlerFn();
      } catch {
        // ignore shutdown handler errors
      }
    }
  });
}

export function clearShutdownHandlers(): void {
  handlers.length = 0;
  installed = false;
}
