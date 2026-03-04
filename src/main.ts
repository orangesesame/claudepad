declare const __APP_VERSION__: string;
import "@xterm/xterm/css/xterm.css";
import { TerminalManager } from "./terminal/terminal-manager";
import { EditorManager } from "./editor/editor-manager";
import { FileExplorer } from "./explorer/file-explorer";
import { Splitter } from "./layout/splitter";
import { open } from "@tauri-apps/plugin-dialog";
import { saveLastFolder, loadLastFolder, copyClaudeToClipboard, readClipboard, collectTasks, writeFile, TaskFile, openFileWindow, hideClaudeView } from "./commands";
import { QuickOpen } from "./quick-open";
import { GlobalSearch } from "./search/global-search";

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

  // Check for single-file mode (opened from double-click in explorer)
  const urlParams = new URLSearchParams(window.location.search);
  const singleFilePath = urlParams.get("file");

  if (singleFilePath) {
    // Single-file mode: hide everything except the editor
    explorerPane.style.display = "none";
    splitterExplorerEl.style.display = "none";
    terminalPane.style.display = "none";
    splitterEl.style.display = "none";
    document.getElementById("toolbar")!.style.display = "none";

    const editorManager = new EditorManager(editorTabs, editorPane);
    await editorManager.openFileByPath(decodeURIComponent(singleFilePath));

    // Version label
    document.getElementById("version-label")!.textContent = `v${__APP_VERSION__}`;
    return;
  }

  // Initialize managers
  const terminalManager = new TerminalManager(terminalTabs, terminalContainer);
  const editorManager = new EditorManager(editorTabs, editorPane);
  const explorer = new FileExplorer(explorerPane);

  // Wire explorer file selection to editor
  explorer.setOnFileSelect((path) => {
    editorManager.openFileByPath(path);
  });

  // Wire explorer double-click to open in new window
  explorer.setOnFileDoubleClick((path) => {
    openFileWindow(path);
  });

  // Quick Open (Cmd+Shift+P)
  const quickOpen = new QuickOpen();
  quickOpen.setOnSelect((path) => {
    editorManager.openFileByPath(path);
  });

  // Global Search (Cmd+Shift+F)
  const globalSearch = new GlobalSearch();
  globalSearch.setOnSelect((path) => {
    editorManager.openFileByPath(path);
  });

  // Initialize splitters
  const explorerSplitter = new Splitter(splitterExplorerEl, explorerPane, editorPane, 140, 200);
  explorerSplitter.setOnResize(() => terminalManager.fitAll());

  const splitter = new Splitter(splitterEl, editorPane, terminalPane);
  splitter.setOnResize(() => terminalManager.fitAll());

  // Create initial terminal
  await terminalManager.addTerminal();

  // Open folder handler — saves to persistent state
  const openFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      const folder = selected as string;
      await explorer.openFolder(folder);
      saveLastFolder(folder).catch(() => {});
    }
  };

  document.getElementById("btn-open-folder")!.addEventListener("click", openFolder);

  // Restore last folder on startup
  try {
    const lastFolder = await loadLastFolder();
    if (lastFolder) {
      await explorer.openFolder(lastFolder);
    }
  } catch {
    // No saved folder — that's fine
  }

  // --- Mode buttons: Claude / Terminal (toggle terminal pane visibility) ---
  const claudeBtn = document.getElementById("btn-claude")!;
  const terminalBtn = document.getElementById("btn-terminal")!;
  let terminalPaneVisible = true;

  const setActiveMode = (btn: HTMLElement | null) => {
    claudeBtn.classList.remove("active");
    terminalBtn.classList.remove("active");
    if (btn) btn.classList.add("active");
  };

  const showTerminalPane = () => {
    terminalPane.style.display = "";
    splitterEl.style.display = "";
    terminalPaneVisible = true;
    requestAnimationFrame(() => terminalManager.fitAll());
  };

  const hideTerminalPane = () => {
    terminalPane.style.display = "none";
    splitterEl.style.display = "none";
    terminalPaneVisible = false;
    setActiveMode(null);
    hideClaudeView().catch(() => {});
  };

  // Set initial terminal button active
  setActiveMode(terminalBtn);

  // Sync toolbar buttons when terminal tabs are clicked directly
  terminalManager.setOnActivate((id) => {
    if (id === "claude-tab") {
      setActiveMode(claudeBtn);
    } else {
      setActiveMode(terminalBtn);
    }
  });

  // Claude button — toggle: show Claude tab or hide terminal pane
  claudeBtn.addEventListener("click", () => {
    if (terminalPaneVisible && claudeBtn.classList.contains("active")) {
      hideTerminalPane();
    } else {
      if (!terminalPaneVisible) showTerminalPane();
      terminalManager.addClaudeTab();
    }
  });

  // Terminal button — toggle: show terminal or hide terminal pane
  terminalBtn.addEventListener("click", () => {
    if (terminalPaneVisible && terminalBtn.classList.contains("active")) {
      hideTerminalPane();
    } else {
      if (!terminalPaneVisible) showTerminalPane();
      terminalManager.activateByIndex(0);
    }
  });

  // Split button — toggles split editor view
  const splitBtn = document.getElementById("btn-split")!;
  splitBtn.addEventListener("click", async () => {
    await editorManager.toggleSplit();
    splitBtn.classList.toggle("active");
  });

  // Filename display — double-click to rename
  const filenameEl = document.getElementById("editor-filename")!;
  filenameEl.addEventListener("dblclick", () => {
    editorManager.renameFromFilenameBar();
  });

  // Close button — closes active file
  document.getElementById("editor-close-btn")!.addEventListener("click", async () => {
    const activeTab = editorManager.getActiveTabId();
    if (activeTab) {
      await editorManager.closeTab(activeTab);
    }
  });

  // Copy to .md — grabs output from active terminal or Claude and inserts at cursor
  document.getElementById("btn-copy-to-md")!.addEventListener("click", async () => {
    let text = "";
    if (terminalManager.isClaudeActive()) {
      try {
        await copyClaudeToClipboard();
        // Small delay for the eval'd JS to execute and clipboard to update
        // Allow time for Claude's Copy button click to update the clipboard
        await new Promise((r) => setTimeout(r, 500));
        text = await readClipboard();
      } catch (err) {
        console.error("Failed to copy from Claude:", err);
      }
    } else {
      text = terminalManager.getTerminalOutput();
    }
    if (text) {
      editorManager.getEditor().insertAtCursor(text);
    }
  });

  // --- Task aggregation buttons ---
  const TASKS_OUTPUT_DIR =
    "/Users/philroberts/Library/CloudStorage/OneDrive-DigitalImpactVentureStudio/Norda/0.Daily Notes";

  const formatTasksMarkdown = (
    title: string,
    files: TaskFile[],
  ): string => {
    let md = `# ${title}\n`;
    for (const file of files) {
      md += `\n## ${file.filename}\n`;
      let lastHeading: string | null = null;
      for (const task of file.tasks) {
        if (task.heading !== lastHeading) {
          if (task.heading) {
            md += `\n### ${task.heading}\n`;
          }
          lastHeading = task.heading;
        }
        md += `- [ ] ${task.text}\n`;
      }
    }
    return md;
  };

  document.getElementById("btn-all-tasks")!.addEventListener("click", async () => {
    const dir = explorer.getRootPath();
    if (!dir) return;
    try {
      const files = await collectTasks(dir);
      // Sort by filename ascending
      files.sort((a, b) => a.filename.localeCompare(b.filename));
      const md = formatTasksMarkdown("All Tasks", files);
      const outPath = `${TASKS_OUTPUT_DIR}/All Tasks.md`;
      await writeFile(outPath, md);
      await editorManager.openFileByPath(outPath);
    } catch (err) {
      console.error("Failed to collect all tasks:", err);
    }
  });

  document.getElementById("btn-daily-tasks")!.addEventListener("click", async () => {
    const dir = explorer.getRootPath();
    if (!dir) return;
    try {
      const files = await collectTasks(dir, "^\\d{4}\\.\\d{2}\\.\\d{2}");
      // Sort by filename descending (reverse)
      files.sort((a, b) => b.filename.localeCompare(a.filename));
      const md = formatTasksMarkdown("Daily Tasks", files);
      const outPath = `${TASKS_OUTPUT_DIR}/Daily Tasks.md`;
      await writeFile(outPath, md);
      await editorManager.openFileByPath(outPath);
    } catch (err) {
      console.error("Failed to collect daily tasks:", err);
    }
  });

  // Toolbar buttons
  document.getElementById("btn-new-term")!.addEventListener("click", () => {
    terminalManager.addTerminal();
  });

  // Global keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key === "s") {
      e.preventDefault();
      editorManager.saveFile();
    } else if (meta && e.shiftKey && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      const dir = explorer.getRootPath();
      if (dir) quickOpen.show(dir);
    } else if (meta && e.shiftKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      const dir = explorer.getRootPath();
      if (dir) globalSearch.show(dir);
    } else if (e.ctrlKey && !e.metaKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      const dir = explorer.getRootPath();
      if (dir) globalSearch.show(dir);
    } else if (e.metaKey && !e.shiftKey && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      editorManager.activateTabByIndex(parseInt(e.key) - 1);
    }
  });

  // Handle window resize for terminal fitting
  window.addEventListener("resize", () => {
    terminalManager.fitAll();
  });

  // Set version label from build-time constant
  document.getElementById("version-label")!.textContent = `v${__APP_VERSION__}`;
});
