import { MilkdownEditor } from "./milkdown-editor";
import { EditorPane } from "./editor-pane";
import { readFile, writeFile, renameFile } from "../commands";
import { open, save } from "@tauri-apps/plugin-dialog";

interface EditorTab {
  id: string;
  label: string;
  path: string | null; // null for untitled
  content: string;
  modified: boolean;
}

let tabCounter = 0;

export class EditorManager {
  private tabs: EditorTab[] = [];
  private panes: EditorPane[] = [];
  private focusedPaneId: string = "left";
  private splitActive = false;
  private splitWrapper: HTMLElement;
  private splitHandle: HTMLElement | null = null;
  private tabBar: HTMLElement;
  private editorPaneEl: HTMLElement;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private filenameEl: HTMLElement | null = null;

  constructor(tabBar: HTMLElement, editorPaneEl: HTMLElement) {
    this.tabBar = tabBar;
    this.editorPaneEl = editorPaneEl;

    // Create the split wrapper
    this.splitWrapper = document.createElement("div");
    this.splitWrapper.className = "split-wrapper";
    this.editorPaneEl.appendChild(this.splitWrapper);

    // Create the initial left pane
    const leftPane = new EditorPane("left");
    this.panes.push(leftPane);
    this.splitWrapper.appendChild(leftPane.rootEl);
    leftPane.setFocused(true);

    leftPane.rootEl.addEventListener("mousedown", () => {
      this.setFocusedPane("left");
    });

    // Show empty state
    leftPane.editorContainer.innerHTML =
      '<div class="empty-state">Open a file (Cmd+O) or create new (Cmd+N)</div>';

    this.filenameEl = document.getElementById("editor-filename");
  }

  async newFile(): Promise<void> {
    const id = `file-${++tabCounter}`;
    const tab: EditorTab = {
      id,
      label: "untitled.md",
      path: null,
      content: "",
      modified: false,
    };
    this.tabs.push(tab);
    this.renderTabs();
    await this.activateTab(id);
  }

  async openFile(): Promise<void> {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (!selected) return;

    const path = selected as string;
    await this.openFileByPath(path);
  }

  async openFileByPath(path: string): Promise<void> {
    // Check if already open in any pane — if so, focus that pane
    for (const pane of this.panes) {
      const tab = this.tabs.find((t) => t.id === pane.activeTabId);
      if (tab && tab.path === path) {
        this.setFocusedPane(pane.id);
        return;
      }
    }

    // Check if already in tabs but not active in any pane
    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      await this.activateTab(existing.id);
      return;
    }

    const content = await readFile(path);
    const id = `file-${++tabCounter}`;
    const label = path.split("/").pop() || "file";

    const tab: EditorTab = { id, label, path, content, modified: false };
    this.tabs.push(tab);
    this.renderTabs();
    await this.activateTab(id);
  }

  async saveFile(): Promise<void> {
    const pane = this.getFocusedPane();
    const tab = this.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab) return;

    tab.content = pane.editor.getContent();

    if (!tab.path) {
      const path = await save({
        defaultPath: tab.label,
        filters: [
          { name: "Markdown", extensions: ["md", "markdown"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!path) return;
      tab.path = path;
      tab.label = path.split("/").pop() || "file";
    }

    await writeFile(tab.path, tab.content);
    tab.modified = false;
    this.renderTabs();
  }

  async closeTab(id: string): Promise<void> {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    this.tabs.splice(idx, 1);

    for (const pane of this.panes) {
      if (pane.activeTabId === id) {
        if (this.tabs.length === 0) {
          pane.activeTabId = null;
          await pane.editor.destroy();
          pane.editorContainer.innerHTML =
            '<div class="empty-state">Open a file (Cmd+O) or create new (Cmd+N)</div>';
        } else {
          const newIdx = Math.min(idx, this.tabs.length - 1);
          await this.activateTabInPane(this.tabs[newIdx].id, pane);
        }
      }
    }
    this.renderTabs();
  }

  getEditor(): MilkdownEditor {
    return this.getFocusedPane().editor;
  }

  renameActiveFile(tabEl: HTMLElement): void {
    const pane = this.getFocusedPane();
    const tab = this.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab || !tab.path) return;

    const labelSpan = tabEl.querySelector(".tab-label") as HTMLElement;
    if (!labelSpan) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = tab.label;
    input.className = "tab-rename-input";
    input.style.cssText =
      "background:var(--bg);color:var(--text);border:1px solid var(--accent);font-family:var(--font);font-size:11px;padding:0 4px;width:120px;outline:none;border-radius:2px;";

    labelSpan.replaceWith(input);
    input.focus();
    const dotIdx = input.value.lastIndexOf(".");
    input.setSelectionRange(0, dotIdx > 0 ? dotIdx : input.value.length);

    const commit = async () => {
      const newName = input.value.trim();
      if (newName && newName !== tab.label && tab.path) {
        const dir = tab.path.substring(0, tab.path.lastIndexOf("/"));
        const newPath = dir + "/" + newName;
        try {
          await renameFile(tab.path, newPath);
          tab.path = newPath;
          tab.label = newName;
        } catch (err) {
          console.error("Rename failed:", err);
        }
      }
      this.renderTabs();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        input.removeEventListener("blur", commit);
        this.renderTabs();
      }
    });
  }

  async toggleSplit(): Promise<void> {
    if (this.splitActive) {
      // Unsplit: save right pane's content and destroy it
      const rightPane = this.panes.find((p) => p.id === "right");
      if (rightPane) {
        if (rightPane.activeTabId) {
          const tab = this.tabs.find((t) => t.id === rightPane.activeTabId);
          if (tab) tab.content = rightPane.editor.getContent();
        }
        await rightPane.destroy();
        this.panes = this.panes.filter((p) => p.id !== "right");
      }
      if (this.splitHandle) {
        this.splitHandle.remove();
        this.splitHandle = null;
      }
      this.splitActive = false;
      this.splitWrapper.classList.remove("split-active");
      this.focusedPaneId = "left";
      this.panes[0].setFocused(true);
      this.panes[0].rootEl.style.flex = "1";
      this.panes[0].rootEl.style.height = "";
    } else {
      // Split: create right pane
      this.splitHandle = document.createElement("div");
      this.splitHandle.className = "split-handle";
      this.splitWrapper.appendChild(this.splitHandle);

      const rightPane = new EditorPane("right");
      this.panes.push(rightPane);
      this.splitWrapper.appendChild(rightPane.rootEl);

      rightPane.rootEl.addEventListener("mousedown", () => {
        this.setFocusedPane("right");
      });

      rightPane.editorContainer.innerHTML =
        '<div class="empty-state">Open a file here</div>';

      this.splitActive = true;
      this.splitWrapper.classList.add("split-active");

      this.panes[0].rootEl.style.flex = "1";
      rightPane.rootEl.style.flex = "1";

      this.initSplitHandleDrag();
    }
    this.renderTabs();
  }

  isSplitActive(): boolean {
    return this.splitActive;
  }

  private getFocusedPane(): EditorPane {
    return this.panes.find((p) => p.id === this.focusedPaneId) ?? this.panes[0];
  }

  private setFocusedPane(id: string): void {
    this.focusedPaneId = id;
    for (const pane of this.panes) {
      pane.setFocused(pane.id === id);
    }
  }

  async activateTabByIndex(index: number): Promise<void> {
    if (index >= 0 && index < this.tabs.length) {
      await this.activateTab(this.tabs[index].id);
    }
  }

  private async activateTab(id: string): Promise<void> {
    await this.activateTabInPane(id, this.getFocusedPane());
  }

  private async activateTabInPane(id: string, pane: EditorPane): Promise<void> {
    // Save current content from this pane's active tab
    if (pane.activeTabId) {
      const currentTab = this.tabs.find((t) => t.id === pane.activeTabId);
      if (currentTab) {
        currentTab.content = pane.editor.getContent();
      }
    }

    pane.activeTabId = id;
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    // Clear empty state
    const emptyState = pane.editorContainer.querySelector(".empty-state");
    if (emptyState) pane.editorContainer.innerHTML = "";

    await pane.editor.create(pane.editorContainer, tab.content);
    pane.editor.onChange((content) => {
      tab.content = content;
      if (!tab.modified) {
        tab.modified = true;
        this.renderTabs();
      }
      this.scheduleAutoSave(tab);
    });

    this.setFocusedPane(pane.id);
    this.renderTabs();
    pane.editor.focus();
  }

  private scheduleAutoSave(tab: EditorTab): void {
    if (!tab.path) return;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(async () => {
      if (tab.path && tab.modified) {
        await writeFile(tab.path, tab.content);
        tab.modified = false;
        this.renderTabs();
      }
    }, 1000);
  }

  private initSplitHandleDrag(): void {
    if (!this.splitHandle) return;
    const topPane = this.panes.find((p) => p.id === "left")!;
    const bottomPane = this.panes.find((p) => p.id === "right")!;
    let dragging = false;

    this.splitHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      dragging = true;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    });

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const wrapperRect = this.splitWrapper.getBoundingClientRect();
      const y = e.clientY - wrapperRect.top;
      const minHeight = 100;
      const maxHeight = wrapperRect.height - minHeight - 4;
      const topHeight = Math.max(minHeight, Math.min(maxHeight, y));
      topPane.rootEl.style.flex = "none";
      topPane.rootEl.style.height = `${topHeight}px`;
      bottomPane.rootEl.style.flex = "1";
    };

    const onMouseUp = () => {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  private updateFilenameDisplay(): void {
    if (!this.filenameEl) return;
    const pane = this.getFocusedPane();
    const tab = this.tabs.find((t) => t.id === pane.activeTabId);
    this.filenameEl.textContent = tab ? tab.label : "";

    const pathEl = document.getElementById("editor-filepath");
    if (pathEl) {
      if (tab?.path) {
        const nordaIdx = tab.path.indexOf("Norda/");
        pathEl.textContent = nordaIdx >= 0 ? tab.path.substring(nordaIdx) : tab.path;
      } else {
        pathEl.textContent = "";
      }
    }
  }

  getActiveTabId(): string | null {
    return this.getFocusedPane().activeTabId;
  }

  renameFromFilenameBar(): void {
    const pane = this.getFocusedPane();
    const tab = this.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab || !tab.path || !this.filenameEl) return;

    const span = this.filenameEl;
    const originalText = span.textContent || "";
    const input = document.createElement("input");
    input.type = "text";
    input.value = tab.label;
    input.style.cssText =
      "background:var(--bg);color:var(--text);border:1px solid var(--accent);font-family:var(--font);font-size:11px;padding:0 4px;width:140px;outline:none;border-radius:2px;";

    span.replaceWith(input);
    input.focus();
    const dotIdx = input.value.lastIndexOf(".");
    input.setSelectionRange(0, dotIdx > 0 ? dotIdx : input.value.length);

    const commit = async () => {
      const newName = input.value.trim();
      if (newName && newName !== tab.label && tab.path) {
        const dir = tab.path.substring(0, tab.path.lastIndexOf("/"));
        const newPath = dir + "/" + newName;
        try {
          await renameFile(tab.path, newPath);
          tab.path = newPath;
          tab.label = newName;
        } catch (err) {
          console.error("Rename failed:", err);
        }
      }
      input.replaceWith(span);
      this.filenameEl = span;
      this.updateFilenameDisplay();
      this.renderTabs();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        input.removeEventListener("blur", commit);
        input.replaceWith(span);
        this.filenameEl = span;
        span.textContent = originalText;
      }
    });
  }

  private renderTabs(): void {
    this.tabBar.innerHTML = "";
    const leftActiveId = this.panes.find((p) => p.id === "left")?.activeTabId;
    const rightActiveId = this.panes.find((p) => p.id === "right")?.activeTabId;

    for (const tab of this.tabs) {
      const el = document.createElement("div");
      const isLeftActive = tab.id === leftActiveId;
      const isRightActive = tab.id === rightActiveId;
      const isActive = isLeftActive || isRightActive;
      el.className = `tab${isActive ? " active" : ""}`;
      if (this.splitActive && isLeftActive) el.classList.add("tab-pane-left");
      if (this.splitActive && isRightActive) el.classList.add("tab-pane-right");
      el.dataset.id = tab.id;
      el.innerHTML = `
        <span class="tab-label">${tab.modified ? "● " : ""}${tab.label}</span>
        <span class="tab-close">&times;</span>
      `;
      el.addEventListener("click", async (e) => {
        if ((e.target as HTMLElement).classList.contains("tab-close")) {
          await this.closeTab(tab.id);
        } else {
          await this.activateTab(tab.id);
        }
      });
      el.addEventListener("dblclick", async (e) => {
        if (!(e.target as HTMLElement).classList.contains("tab-close")) {
          await this.activateTab(tab.id);
          this.renameActiveFile(el);
        }
      });
      this.tabBar.appendChild(el);
    }
    this.updateFilenameDisplay();
  }
}
