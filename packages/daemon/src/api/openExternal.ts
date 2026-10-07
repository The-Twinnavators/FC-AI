/**
 * Opens a web link in the person's default browser, the way the desktop app does with shell.openExternal. Used when
 * FlowCode runs inside a browser that blocks new tabs. Only plain http(s) URLs are accepted; the URL is passed as a
 * single argument (never through a shell string), so it cannot inject commands.
 */
import { spawn } from "node:child_process";

export function openExternal(raw: string): { opened: boolean } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Not a valid link");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only web links (http or https) can be opened");
  const href = url.toString();
  // Windows: rundll32's URL handler opens the default browser without going through cmd.exe parsing.
  const [cmd, args] =
    process.platform === "win32" ? ["rundll32.exe", ["url.dll,FileProtocolHandler", href]] : process.platform === "darwin" ? ["open", [href]] : ["xdg-open", [href]];
  const child = spawn(cmd, args as string[], { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => undefined);
  child.unref();
  return { opened: true };
}
