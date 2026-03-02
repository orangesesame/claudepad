import { MarkdownEditor } from "./markdown-editor";
import { MarkdownPreview } from "./markdown-preview";
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
  private activeTabId: string | null = null;
  private editor: MarkdownEditor;
  private preview: MarkdownPreview;
  private tabBar: HTMLElement;
  private editorContainer: HTMLElement;
  private previewContainer: HTMLElement;
  private previewVisible = true;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    tabBar: HTMLElement,
    editorContainer: HTMLElement,
    previewContainer: HTMLElement
  ) {
    this.tabBar = tabBar;
    this.editorContainer = editorContainer;
    this.previewContainer = previewContainer;

    this.editor = new MarkdownEditor();
    this.preview = new MarkdownPreview(previewContainer);

    // Wire preview checkbox toggles back to editor source
    this.preview.setOnCheckboxToggle((lineNumber) => {
      this.editor.toggleCheckboxAtLine(lineNumber);
      // Update tab content and re-render preview
      const tab = this.getActiveTab();
      if (tab) {
        tab.content = this.editor.getContent();
        this.preview.render(tab.content);
        this.scheduleAutoSave(tab);
      }
    });

    // Start in preview mode by default
    this.editorContainer.style.display = "none";
    const formatToolbar = document.getElementById("format-toolbar");
    if (formatToolbar) formatToolbar.style.display = "none";
    this.previewContainer.classList.remove("hidden");
    this.previewContainer.innerHTML = '<div class="empty-state">Open a file (Cmd+O) or create new (Cmd+N)</div>';
  }

  newFile(): void {
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
    this.activateTab(id);
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

    // Check if already open
    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      this.activateTab(existing.id);
      return;
    }

    const content = await readFile(path);
    const id = `file-${++tabCounter}`;
    const label = path.split("/").pop() || "file";

    const tab: EditorTab = { id, label, path, content, modified: false };
    this.tabs.push(tab);
    this.renderTabs();
    this.activateTab(id);
  }

  async openFileByPath(path: string): Promise<void> {
    // Check if already open
    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      this.activateTab(existing.id);
      return;
    }

    const content = await readFile(path);
    const id = `file-${++tabCounter}`;
    const label = path.split("/").pop() || "file";

    const tab: EditorTab = { id, label, path, content, modified: false };
    this.tabs.push(tab);
    this.renderTabs();
    this.activateTab(id);
  }

  async saveFile(): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) return;

    // Save current editor content to tab
    tab.content = this.editor.getContent();

    if (!tab.path) {
      // Save As
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

  closeTab(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.editor.destroy();
      this.editorContainer.innerHTML = '<div class="empty-state">Open a file (Cmd+O) or create new (Cmd+N)</div>';
      this.previewContainer.classList.add("hidden");
    } else if (this.activeTabId === id) {
      const newIdx = Math.min(idx, this.tabs.length - 1);
      this.activateTab(this.tabs[newIdx].id);
    }
    this.renderTabs();
  }

  getEditor(): MarkdownEditor {
    return this.editor;
  }

  renameActiveFile(tabEl: HTMLElement): void {
    const tab = this.getActiveTab();
    if (!tab || !tab.path) return;

    const labelSpan = tabEl.querySelector(".tab-label") as HTMLElement;
    if (!labelSpan) return;

    // Replace the label with an inline input
    const input = document.createElement("input");
    input.type = "text";
    input.value = tab.label;
    input.className = "tab-rename-input";
    input.style.cssText = "background:var(--bg);color:var(--text);border:1px solid var(--accent);font-family:var(--font);font-size:11px;padding:0 4px;width:120px;outline:none;border-radius:2px;";

    labelSpan.replaceWith(input);
    input.focus();
    // Select the name without the extension
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

  togglePreview(): void {
    this.previewVisible = !this.previewVisible;

    const formatToolbar = document.getElementById("format-toolbar");

    if (this.previewVisible) {
      // Hide editor, show preview in same space
      this.editorContainer.style.display = "none";
      if (formatToolbar) formatToolbar.style.display = "none";
      this.previewContainer.classList.remove("hidden");
      const tab = this.getActiveTab();
      if (tab) {
        this.preview.render(tab.content);
      }
    } else {
      // Hide preview, show editor
      this.previewContainer.classList.add("hidden");
      this.editorContainer.style.display = "";
      if (formatToolbar) formatToolbar.style.display = "";
    }
  }

  private activateTab(id: string): void {
    // Save current tab's content
    const current = this.getActiveTab();
    if (current) {
      current.content = this.editor.getContent();
    }

    this.activeTabId = id;
    const tab = this.getActiveTab();
    if (!tab) return;

    // Clear empty state and create editor
    const emptyState = this.editorContainer.querySelector(".empty-state");
    if (emptyState) {
      this.editorContainer.innerHTML = "";
    }

    this.editor.create(this.editorContainer, tab.content);
    this.editor.onChange((content) => {
      tab.content = content;
      if (!tab.modified) {
        tab.modified = true;
        this.renderTabs();
      }
      if (this.previewVisible) {
        this.preview.render(content);
      }
      this.scheduleAutoSave(tab);
    });

    if (this.previewVisible) {
      this.preview.render(tab.content);
    }

    this.renderTabs();
    this.editor.focus();
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

  private getActiveTab(): EditorTab | null {
    return this.tabs.find((t) => t.id === this.activeTabId) ?? null;
  }

  private renderTabs(): void {
    this.tabBar.innerHTML = "";
    for (const tab of this.tabs) {
      const el = document.createElement("div");
      el.className = `tab${tab.id === this.activeTabId ? " active" : ""}`;
      el.dataset.id = tab.id;
      el.innerHTML = `
        <span class="tab-label">${tab.modified ? "● " : ""}${tab.label}</span>
        <span class="tab-close">&times;</span>
      `;
      el.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("tab-close")) {
          this.closeTab(tab.id);
        } else {
          this.activateTab(tab.id);
        }
      });
      el.addEventListener("dblclick", (e) => {
        if (!(e.target as HTMLElement).classList.contains("tab-close")) {
          this.activateTab(tab.id);
          this.renameActiveFile(el);
        }
      });
      this.tabBar.appendChild(el);
    }
  }
}
