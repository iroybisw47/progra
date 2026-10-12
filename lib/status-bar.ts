import { systemBarsPlugin } from "@/lib/native-plugins";

// The iOS status bar's text colour, through Capacitor's built-in SystemBars
// plugin (lib/native-plugins.ts).
//
// NAMED BY THE TEXT, on purpose. The plugin names its styles by the BACKGROUND
// they suit: Style.Dark is LIGHT text (for dark backgrounds) and Style.Light is
// dark text. "light" here always means light glyphs. "default" is what the app
// runs with everywhere else (CAPBridgeViewController's .default).
export type StatusBarText = "light" | "dark" | "default";

export function statusBarStyle(text: StatusBarText): "DARK" | "LIGHT" | "DEFAULT" {
  if (text === "light") return "DARK";
  if (text === "dark") return "LIGHT";
  return "DEFAULT";
}

// Fire and forget. Does nothing on the website.
export function setStatusBarText(text: StatusBarText): void {
  const plugin = systemBarsPlugin();
  if (!plugin) return;
  plugin.setStyle({ style: statusBarStyle(text) }).catch(() => {});
}
