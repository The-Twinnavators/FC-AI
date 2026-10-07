/** Minimal, explicit bridge: connection details and native folder selection only. */
import { contextBridge, ipcRenderer } from "electron";

const conn = ipcRenderer.sendSync("flowcode:connection") as { port: number; token: string } | null;

contextBridge.exposeInMainWorld("flowcode", {
  port: conn?.port ?? 0,
  token: conn?.token ?? "",
  platform: process.platform,
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("flowcode:select-folder"),
});
