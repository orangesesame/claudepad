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

export async function readFile(path: string): Promise<string> {
  return await invoke("read_file", { path });
}

export async function writeFile(
  path: string,
  contents: string
): Promise<void> {
  await invoke("write_file", { path, contents });
}
