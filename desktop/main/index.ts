import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IPC_CHANNELS } from "../shared/ipc.js";
import { ConfigService } from "./services/config-service.js";
import { DataService } from "./services/data-service.js";
import { CupiBotService } from "./services/cupibot-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

const configService = new ConfigService();
const dataService = new DataService();
const cupibotService = new CupiBotService(() => mainWindow);

function resolveRendererUrl(): string | null {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL?.trim();

  if (!rendererUrl) {
    return null;
  }

  return rendererUrl;
}

function resolveAppIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, "build", "icon.png")]
    : [
      path.join(process.cwd(), "build", "icon.png"),
      path.join(process.cwd(), "src", "ui", "Icon.png"),
    ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function shouldOpenExternalUrl(url: string): boolean {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  const rendererUrl = resolveRendererUrl();

  if (rendererUrl) {
    const rendererOrigin = new URL(rendererUrl).origin;

    if (url.startsWith(rendererOrigin)) {
      return false;
    }
  }

  return true;
}

function createWindow(): void {
  const iconPath = resolveAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "CupiBot",
    show: false,
    backgroundColor: "#f2f7f9",
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (shouldOpenExternalUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`[Renderer] failed to load ${url}: ${code} ${description}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[Renderer] process gone: ${details.reason}`);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  const rendererUrl = resolveRendererUrl();

  if (rendererUrl) {
    console.log(`[CupiBot] loading dev renderer: ${rendererUrl}`);
    void mainWindow.loadURL(rendererUrl);
  } else {
    const filePath = path.join(__dirname, "../renderer/index.html");

    console.log(`[CupiBot] loading built renderer: ${filePath}`);
    void mainWindow.loadFile(filePath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CUPIBOT_GET_DATA_DIR, () => cupibotService.getDataDir());

  ipcMain.handle(IPC_CHANNELS.CONFIG_READ_ENV, () => configService.readEnv());
  ipcMain.handle(IPC_CHANNELS.CONFIG_WRITE_ENV, (_event, variables) => {
    configService.writeEnv(variables);
  });
  ipcMain.handle(IPC_CHANNELS.CONFIG_LIST_JSON, () => configService.listJsonConfigs());
  ipcMain.handle(IPC_CHANNELS.CONFIG_READ_JSON, (_event, relativePath: string) =>
    configService.readJson(relativePath));
  ipcMain.handle(IPC_CHANNELS.CONFIG_WRITE_JSON, (_event, relativePath: string, content: string) => {
    configService.writeJson(relativePath, content);
  });
  ipcMain.handle(IPC_CHANNELS.CONFIG_VALIDATE, () => configService.validate());
  ipcMain.handle(IPC_CHANNELS.CONFIG_SETUP, () => configService.setup());

  ipcMain.handle(IPC_CHANNELS.DATA_LIST_CONVERSATIONS, () => dataService.listConversations());
  ipcMain.handle(IPC_CHANNELS.DATA_READ_CONVERSATION, (_event, fileName: string) =>
    dataService.readConversation(fileName));
  ipcMain.handle(IPC_CHANNELS.DATA_READ_HISTORICAL, () => dataService.readHistorical());
  ipcMain.handle(IPC_CHANNELS.DATA_READ_INSTAGRAMS, () => dataService.readInstagrams());
  ipcMain.handle(IPC_CHANNELS.DATA_READ_UNMATCHES, () => dataService.readUnmatches());
  ipcMain.handle(IPC_CHANNELS.DATA_READ_RUNTIME_CONTEXT, () => dataService.readRuntimeContext());
  ipcMain.handle(IPC_CHANNELS.DATA_READ_ANALYSIS, () => dataService.readAnalysisReport());

  ipcMain.handle(IPC_CHANNELS.BOOTSTRAP_CHECK, () => cupibotService.checkBootstrap());
  ipcMain.handle(IPC_CHANNELS.BOOTSTRAP_RUN, () => cupibotService.runBootstrap());

  ipcMain.handle(IPC_CHANNELS.CUPIBOT_RUN, async (_event, mode) => {
    await cupibotService.run(mode);
  });
  ipcMain.handle(IPC_CHANNELS.CUPIBOT_ABORT, () => {
    cupibotService.abort();
  });
}

app.whenReady().then(() => {
  process.env.CUPIBOT_APP_ROOT = app.isPackaged
    ? process.resourcesPath
    : process.cwd();

  try {
    configService.init();
  } catch (error) {
    console.error(
      `[Config] init failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  registerIpcHandlers();
  createWindow();

  void cupibotService.runBootstrap().catch((error) => {
    console.error(
      `[Bootstrap] startup install failed: ${error instanceof Error ? error.message : error}`,
    );
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
