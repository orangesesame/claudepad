import { invoke, Channel } from "@tauri-apps/api/core";

export interface PtyData {
  id: string;
  data: number[];
}

export async function createPty(
  id: string,
  cols: number,
  rows: number,
  onData: (data: PtyData) => void
): Promise<void> {
  const channel = new Channel<PtyData>();
  channel.onmessage = onData;
  await invoke("create_pty", { id, cols, rows, onData: channel });
}

export async function writePty(id: string, data: number[]): Promise<void> {
  await invoke("write_pty", { id, data });
}

export async function resizePty(
  id: string,
  cols: number,
  rows: number
): Promise<void> {
  await invoke("resize_pty", { id, cols, rows });
}

export async function killPty(id: string): Promise<void> {
  await invoke("kill_pty", { id });
}

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export async function readDir(path: string): Promise<DirEntry[]> {
  return await invoke("read_dir", { path });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await invoke("rename_file", { oldPath, newPath });
}

export async function readFile(path: string): Promise<string> {
  return await invoke("read_file", { path });
}

export async function writeFile(
  path: string,
  contents: string
): Promise<void> {
  await invoke("write_file", { path, contents });
}

export async function toggleClaudeView(
  x: number,
  y: number,
  width: number,
  height: number
): Promise<boolean> {
  return await invoke("toggle_claude_view", { x, y, width, height });
}

export async function resizeClaudeView(
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await invoke("resize_claude_view", { x, y, width, height });
}

export async function hideClaudeView(): Promise<void> {
  await invoke("hide_claude_view");
}
