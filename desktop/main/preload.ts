import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc.js";
import type { AppMode } from "../shared/types.js";
import type { CupiBotApi } from "../shared/ipc.js";

const api: CupiBotApi = {
  getDataDir: () => ipcRenderer.invoke(IPC_CHANNELS.CUPIBOT_GET_DATA_DIR),
  readEnv: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_READ_ENV),
  writeEnv: (variables) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_WRITE_ENV, variables),
  listJsonConfigs: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LIST_JSON),
  readJson: (relativePath) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_READ_JSON, relativePath),
  writeJson: (relativePath, content) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_WRITE_JSON, relativePath, content),
  validateConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_VALIDATE),
  setupConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SETUP),
  listConversations: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_LIST_CONVERSATIONS),
  readConversation: (fileName) => ipcRenderer.invoke(IPC_CHANNELS.DATA_READ_CONVERSATION, fileName),
  readHistorical: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_READ_HISTORICAL),
  readInstagrams: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_READ_INSTAGRAMS),
  readUnmatches: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_READ_UNMATCHES),
  readRuntimeContext: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_READ_RUNTIME_CONTEXT),
  readAnalysisReport: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_READ_ANALYSIS),
  checkBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.BOOTSTRAP_CHECK),
  runBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.BOOTSTRAP_RUN),
  runCupiBot: (mode: AppMode) => ipcRenderer.invoke(IPC_CHANNELS.CUPIBOT_RUN, mode),
  abortCupiBot: () => ipcRenderer.invoke(IPC_CHANNELS.CUPIBOT_ABORT),
  onLog: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: unknown) => {
      callback(entry as Parameters<CupiBotApi["onLog"]>[0] extends (e: infer E) => void ? E : never);
    };

    ipcRenderer.on(IPC_CHANNELS.CUPIBOT_LOG, listener);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CUPIBOT_LOG, listener);
    };
  },
  onProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      callback(progress as Parameters<CupiBotApi["onProgress"]>[0] extends (p: infer P) => void ? P : never);
    };

    ipcRenderer.on(IPC_CHANNELS.CUPIBOT_PROGRESS, listener);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CUPIBOT_PROGRESS, listener);
    };
  },
  onBootstrapProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      callback(progress as Parameters<CupiBotApi["onBootstrapProgress"]>[0] extends (p: infer P) => void ? P : never);
    };

    ipcRenderer.on(IPC_CHANNELS.BOOTSTRAP_PROGRESS, listener);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.BOOTSTRAP_PROGRESS, listener);
    };
  },
  onComplete: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: unknown) => {
      callback(result as Parameters<CupiBotApi["onComplete"]>[0] extends (r: infer R) => void ? R : never);
    };

    ipcRenderer.on(IPC_CHANNELS.CUPIBOT_COMPLETE, listener);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CUPIBOT_COMPLETE, listener);
    };
  },
};

contextBridge.exposeInMainWorld("cupibot", api);
