import readline from "node:readline";
import type { AppMode } from "./config/app-config.js";
import { runCupiBot } from "./cupibot-runner.js";
import { printCupiBotBanner } from "./ui/banner.js";
import { exitOnAiFailure } from "./infrastructure/ai/ai-error.js";

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectMode(): Promise<AppMode> {
  const choice = await promptUser(
    "\n>> Select mode:\n" +
      ">>   1. Swipe (Tinder)\n" +
      ">>   2. Chat (Tinder)\n" +
      ">>   3. Swipe (Bumble)\n" +
      ">>   4. Swipe + Chat (Tinder)\n" +
      ">>   5. Análisis (Tinder)\n" +
      ">> Choice (1/2/3/4/5): ",
  );

  switch (choice) {
    case "2":
      return "tinder-chat";
    case "3":
      return "bumble-swipe";
    case "4":
      return "tinder-swipe-chat";
    case "5":
      return "tinder-analisis";
    default:
      return "tinder-swipe";
  }
}

async function main(): Promise<void> {
  printCupiBotBanner();

  const mode = await selectMode();
  const result = await runCupiBot({ mode });

  if (!result.ok) {
    if (result.reason === "ai_unavailable" && result.error) {
      exitOnAiFailure(new Error(result.error.message));
    }

    console.error(`[CupiBot] session ended: ${result.reason}`);

    if (result.error) {
      console.error(`[CupiBot] ${result.error.message}`);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `[CupiBot] startup failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
});
