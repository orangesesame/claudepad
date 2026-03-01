import "@xterm/xterm/css/xterm.css";
import { TerminalManager } from "./terminal/terminal-manager";
import { EditorManager } from "./editor/editor-manager";
import { FileExplorer } from "./explorer/file-explorer";
import { Splitter } from "./layout/splitter";
import { open } from "@tauri-apps/plugin-dialog";

// Wait for DOM
document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
  const explorerPane = document.getElementById("explorer-pane")!;
  const editorPane = document.getElementById("editor-pane")!;
  const terminalPane = document.getElementById("terminal-pane")!;
  const splitterExplorerEl = document.getElementById("splitter-explorer")!;
  const splitterEl = document.getElementById("splitter")!;
  const terminalTabs = document.getElementById("terminal-tabs")!;
  const terminalContainer = document.getElementById("terminal-container")!;
  const editorTabs = document.getElementById("editor-tabs")!;
  const editorContainer = document.getElementById("editor-container")!;
  const previewContainer = document.getElementById("preview-container")!;

  // Initialize managers
  const terminalManager = new TerminalManager(terminalTabs, terminalContainer);
  const editorManager = new EditorManager(editorTabs, editorContainer, previewContainer);
  const explorer = new FileExplorer(explorerPane);

  // Wire explorer file selection to editor
  explorer.setOnFileSelect((path) => {
    editorManager.openFileByPath(path);
  });

  // Initialize splitters
  const explorerSplitter = new Splitter(splitterExplorerEl, explorerPane, editorPane, 140, 200);
  explorerSplitter.setOnResize(() => terminalManager.fitAll());

  const splitter = new Splitter(splitterEl, editorPane, terminalPane);
  splitter.setOnResize(() => terminalManager.fitAll());

  // Create initial terminal
  await terminalManager.addTerminal();

  // Open folder handler
  const openFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      await explorer.openFolder(selected as string);
    }
  };

  document.getElementById("btn-open-folder")!.addEventListener("click", openFolder);

  // Toolbar buttons
  document.getElementById("btn-new-term")!.addEventListener("click", () => {
    terminalManager.addTerminal();
  });

  document.getElementById("btn-open-file")!.addEventListener("click", () => {
    editorManager.openFile();
  });

  document.getElementById("btn-new-file")!.addEventListener("click", () => {
    editorManager.newFile();
  });

  document.getElementById("btn-save-file")!.addEventListener("click", () => {
    editorManager.saveFile();
  });

  document.getElementById("btn-toggle-preview")!.addEventListener("click", () => {
    editorManager.togglePreview();
  });

  // Global keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key === "n") {
      e.preventDefault();
      terminalManager.addTerminal();
    } else if (meta && e.key === "o") {
      e.preventDefault();
      editorManager.openFile();
    } else if (meta && e.key === "s") {
      e.preventDefault();
      editorManager.saveFile();
    } else if (meta && e.key === "p") {
      e.preventDefault();
      editorManager.togglePreview();
    } else if (meta && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      terminalManager.activateByIndex(parseInt(e.key) - 1);
    }
  });

  // Handle window resize for terminal fitting
  window.addEventListener("resize", () => {
    terminalManager.fitAll();
  });
});
