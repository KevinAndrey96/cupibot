export function wireAbortSignal(
  signal: AbortSignal | undefined,
  abortFns: Array<() => void>,
): void {
  if (!signal) {
    return;
  }

  const runAbortHandlers = () => {
    for (const fn of abortFns) {
      fn();
    }
  };

  if (signal.aborted) {
    runAbortHandlers();

    return;
  }

  signal.addEventListener("abort", runAbortHandlers, { once: true });
}
