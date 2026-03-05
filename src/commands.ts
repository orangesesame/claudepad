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

export async function showClaudeView(
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await invoke("show_claude_view", { x, y, width, height });
}

export async function hideClaudeView(): Promise<void> {
  await invoke("hide_claude_view");
}

export async function copyClaudeToClipboard(): Promise<void> {
  await invoke("copy_claude_to_clipboard");
}

export async function readClipboard(): Promise<string> {
  return await invoke("read_clipboard");
}

export async function saveLastFolder(path: string): Promise<void> {
  await invoke("save_last_folder", { path });
}

export async function loadLastFolder(): Promise<string | null> {
  return await invoke("load_last_folder");
}

export interface Bookmark {
  name: string;
  path: string;
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  await invoke("save_bookmarks", { bookmarks });
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  return await invoke("load_bookmarks");
}

export interface TaskItem {
  text: string;
  heading: string | null;
}

export interface TaskFile {
  filename: string;
  path: string;
  tasks: TaskItem[];
}

export async function collectTasks(
  dir: string,
  filenameRegex?: string
): Promise<TaskFile[]> {
  return await invoke("collect_tasks", {
    dir,
    filenameRegex: filenameRegex ?? null,
  });
}

export interface FileEntry {
  name: string;
  path: string;
  relative: string;
  is_dir: boolean;
}

export async function listMdFiles(dir: string): Promise<FileEntry[]> {
  return await invoke("list_md_files", { dir });
}

export interface SearchResult {
  path: string;
  relative: string;
  line_number: number;
  line_text: string;
}

export interface FileWithTime {
  name: string;
  path: string;
  relative: string;
  created_ms: number;
}

export async function listFilesByPrefix(dir: string, prefix: string): Promise<FileEntry[]> {
  return await invoke("list_files_by_prefix", { dir, prefix });
}

export async function listMdFilesByCreated(dir: string): Promise<FileWithTime[]> {
  return await invoke("list_md_files_by_created", { dir });
}

export async function searchMdFiles(
  dir: string,
  query: string
): Promise<SearchResult[]> {
  return await invoke("search_md_files", { dir, query });
}

export async function openFileWindow(path: string): Promise<void> {
  await invoke("open_file_window", { path });
}
