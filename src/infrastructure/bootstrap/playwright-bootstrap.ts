import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);

export function isChromiumInstalled(): boolean {
  try {
    const executablePath = chromium.executablePath();

    return fs.existsSync(executablePath);
  } catch {
    return false;
  }
}

export async function installChromium(): Promise<void> {
  const playwrightRoot = path.dirname(require.resolve("playwright/package.json"));
  const cliPath = path.join(playwrightRoot, "cli.js");

  await runNodeScript(cliPath, ["install", "chromium"]);
}

function runNodeScript(
  scriptPath: string,
  args: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (error) => {
      reject(new Error(`spawn ${scriptPath}: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(scriptPath)} ${args.join(" ")} exited with code ${code}`));
    });
  });
}
