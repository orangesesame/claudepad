import { MarkdownEditor } from "./markdown-editor";
import { MarkdownPreview } from "./markdown-preview";
import { readFile, writeFile } from "../commands";
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
  private previewVisible = false;

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

    // Show empty state initially
    this.editorContainer.innerHTML = '<div class="empty-state">Open a file (Cmd+O) or create new (Cmd+N)</div>';
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

  togglePreview(): void {
    this.previewVisible = !this.previewVisible;

    if (this.previewVisible) {
      this.previewContainer.classList.remove("hidden");
      this.editorContainer.style.flex = "1";
      this.previewContainer.style.flex = "1";
      const tab = this.getActiveTab();
      if (tab) {
        this.preview.render(tab.content);
      }
    } else {
      this.previewContainer.classList.add("hidden");
      this.editorContainer.style.flex = "";
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
    });

    if (this.previewVisible) {
      this.preview.render(tab.content);
    }

    this.renderTabs();
    this.editor.focus();
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
      this.tabBar.appendChild(el);
    }
  }
}
