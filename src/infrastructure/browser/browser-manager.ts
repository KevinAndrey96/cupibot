import { chromium, type BrowserContext, type Page } from "playwright";
import type { BrowserManagerPort, Platform } from "../../domain/types.js";
import { resolveUserDataDir } from "../persistence/session-storage.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 800;
const VIEWPORT_JITTER = 20;

export class BrowserManager implements BrowserManagerPort {
  private context: BrowserContext | null = null;

  constructor(
    private readonly headless: boolean,
    private readonly platform: Platform,
  ) {}

  async launch(): Promise<{ context: BrowserContext; page: Page }> {
    const userDataDir = resolveUserDataDir(this.platform);

    const viewport = {
      width: BASE_WIDTH + Math.floor(Math.random() * VIEWPORT_JITTER * 2) - VIEWPORT_JITTER,
      height: BASE_HEIGHT + Math.floor(Math.random() * VIEWPORT_JITTER * 2) - VIEWPORT_JITTER,
    };

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: this.headless,
      viewport,
      userAgent: USER_AGENT,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    this.context = context;

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    await this.applyStealthScripts(page);

    return { context, page };
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  /**
   * Injects scripts to mask common automation fingerprints that
   * Tinder and similar sites check for bot detection.
   */
  private async applyStealthScripts(page: Page): Promise<void> {
    await page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

      const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
      window.navigator.permissions.query = (params) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
    `);
  }
}
