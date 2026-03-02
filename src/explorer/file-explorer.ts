import { readDir, DirEntry, writeFile, Bookmark, saveBookmarks, loadBookmarks, saveLastFolder } from "../commands";

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { name: "Norda", path: "/Users/philroberts/Library/CloudStorage/OneDrive-DigitalImpactVentureStudio/Norda" },
  { name: "OpenClaw", path: "/Users/philroberts/.openclaw/workspace" },
  { name: "ClaudePad", path: "/Users/philroberts/claudepad" },
];

export class FileExplorer {
  private container: HTMLElement;
  private treeContainer: HTMLElement;
  private rootPath: string | null = null;
  private expandedDirs: Set<string> = new Set();
  private onFileSelect: ((path: string) => void) | null = null;
  private bookmarks: Bookmark[] = [];
  private bookmarkList: HTMLElement;
  private focusedRow: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Bookmarks section
    const bookmarkSection = document.createElement("div");
    bookmarkSection.className = "bookmark-section";
    bookmarkSection.innerHTML = `<div class="bookmark-header">
      <span class="bookmark-title">Workspaces</span>
      <button id="btn-add-bookmark" title="Bookmark current folder">+</button>
    </div>`;
    this.container.appendChild(bookmarkSection);

    this.bookmarkList = document.createElement("div");
    this.bookmarkList.className = "bookmark-list";
    bookmarkSection.appendChild(this.bookmarkList);

    bookmarkSection.querySelector("#btn-add-bookmark")!.addEventListener("click", () => {
      this.addCurrentAsBookmark();
    });

    // Header with buttons
    const header = document.createElement("div");
    header.className = "explorer-header";
    header.innerHTML = `
      <button id="btn-open-folder" title="Open Folder">Open Folder</button>
      <button id="btn-new-md" title="New .md file in current folder">+ New .md</button>
    `;
    this.container.appendChild(header);

    // Tree container
    this.treeContainer = document.createElement("div");
    this.treeContainer.className = "explorer-tree";
    this.container.appendChild(this.treeContainer);

    this.treeContainer.innerHTML = '<div class="empty-state">No folder open</div>';
    this.treeContainer.tabIndex = 0;

    // Keyboard navigation
    this.treeContainer.addEventListener("keydown", (e) => this.handleKeyboard(e));

    // New .md button handler
    header.querySelector("#btn-new-md")!.addEventListener("click", () => {
      this.promptNewFile();
    });

    // Load bookmarks
    this.loadBookmarks();
  }

  getRootPath(): string | null {
    return this.rootPath;
  }

  setOnFileSelect(callback: (path: string) => void): void {
    this.onFileSelect = callback;
  }

  async openFolder(path: string): Promise<void> {
    this.rootPath = path;
    this.expandedDirs.clear();
    this.expandedDirs.add(path);
    await this.renderTree();
    this.renderBookmarks();
  }

  private async loadBookmarks(): Promise<void> {
    try {
      this.bookmarks = await loadBookmarks();
      if (this.bookmarks.length === 0) {
        this.bookmarks = [...DEFAULT_BOOKMARKS];
        await saveBookmarks(this.bookmarks);
      }
    } catch {
      this.bookmarks = [...DEFAULT_BOOKMARKS];
    }
    this.renderBookmarks();
  }

  private renderBookmarks(): void {
    this.bookmarkList.innerHTML = "";
    for (const bm of this.bookmarks) {
      const row = document.createElement("div");
      row.className = "bookmark-row";
      if (this.rootPath === bm.path) {
        row.classList.add("bookmark-active");
      }
      row.innerHTML = `<span class="bookmark-name">${bm.name}</span><span class="bookmark-remove" title="Remove bookmark">&times;</span>`;

      row.querySelector(".bookmark-name")!.addEventListener("click", () => {
        this.openFolder(bm.path);
        saveLastFolder(bm.path).catch(() => {});
      });

      row.querySelector(".bookmark-remove")!.addEventListener("click", (e) => {
        e.stopPropagation();
        this.bookmarks = this.bookmarks.filter((b) => b.path !== bm.path);
        saveBookmarks(this.bookmarks).catch(() => {});
        this.renderBookmarks();
      });

      this.bookmarkList.appendChild(row);
    }
  }

  private async addCurrentAsBookmark(): Promise<void> {
    if (!this.rootPath) return;
    // Don't add if already bookmarked
    if (this.bookmarks.some((b) => b.path === this.rootPath)) return;
    const name = this.rootPath.split("/").pop() || this.rootPath;
    this.bookmarks.push({ name, path: this.rootPath });
    await saveBookmarks(this.bookmarks);
    this.renderBookmarks();
  }

  private promptNewFile(): void {
    if (!this.rootPath) return;

    const row = document.createElement("div");
    row.className = "tree-row tree-row-file";
    row.style.paddingLeft = "18px";

    const input = document.createElement("input");
    input.type = "text";
    input.value = "untitled.md";
    input.style.cssText = "background:var(--bg);color:var(--text);border:1px solid var(--accent);font-family:var(--font);font-size:12px;padding:0 4px;width:calc(100% - 8px);outline:none;border-radius:2px;height:20px;";
    row.appendChild(input);

    this.treeContainer.prepend(row);
    input.focus();
    const dotIdx = input.value.lastIndexOf(".");
    input.setSelectionRange(0, dotIdx > 0 ? dotIdx : input.value.length);

    const commit = async () => {
      const name = input.value.trim();
      if (name && this.rootPath) {
        const fileName = name.endsWith(".md") ? name : name + ".md";
        const filePath = this.rootPath + "/" + fileName;
        try {
          await writeFile(filePath, "");
          await this.renderTree();
          this.onFileSelect?.(filePath);
        } catch (err) {
          console.error("Failed to create file:", err);
          row.remove();
        }
      } else {
        row.remove();
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        input.removeEventListener("blur", commit);
        row.remove();
      }
    });
  }

  private async renderTree(): Promise<void> {
    if (!this.rootPath) return;
    this.treeContainer.innerHTML = "";
    await this.buildFolder(this.rootPath, this.treeContainer, 0);
  }

  private async buildFolder(dirPath: string, parent: HTMLElement, depth: number): Promise<void> {
    const isExpanded = this.expandedDirs.has(dirPath);
    const label = dirPath.split("/").pop() || dirPath;

    const row = document.createElement("div");
    row.className = "tree-row tree-row-folder";
    row.style.paddingLeft = `${depth * 14 + 4}px`;
    row.dataset.path = dirPath;
    row.dataset.type = "folder";
    row.innerHTML = `<span class="tree-arrow">${isExpanded ? "&#9660;" : "&#9654;"}</span><span class="tree-label">${label}</span>`;
    parent.appendChild(row);

    const childrenEl = document.createElement("div");
    childrenEl.className = "tree-children";
    if (!isExpanded) childrenEl.style.display = "none";
    parent.appendChild(childrenEl);

    row.addEventListener("click", async () => {
      this.setFocusedRow(row);
      if (this.expandedDirs.has(dirPath)) {
        this.expandedDirs.delete(dirPath);
        childrenEl.style.display = "none";
        row.querySelector(".tree-arrow")!.innerHTML = "&#9654;";
      } else {
        this.expandedDirs.add(dirPath);
        childrenEl.style.display = "";
        row.querySelector(".tree-arrow")!.innerHTML = "&#9660;";
        childrenEl.innerHTML = "";
        await this.loadChildren(dirPath, childrenEl, depth + 1);
      }
    });

    if (isExpanded) {
      await this.loadChildren(dirPath, childrenEl, depth + 1);
    }
  }

  private async loadChildren(dirPath: string, container: HTMLElement, depth: number): Promise<void> {
    try {
      const entries = await readDir(dirPath);

      for (const entry of entries) {
        if (entry.is_dir) {
          await this.buildFolder(entry.path, container, depth);
        } else {
          const row = document.createElement("div");
          const isMd = entry.name.endsWith(".md") || entry.name.endsWith(".markdown");
          row.className = `tree-row tree-row-file${isMd ? "" : " tree-row-dimmed"}`;
          row.style.paddingLeft = `${depth * 14 + 4}px`;
          row.dataset.path = entry.path;
          row.innerHTML = `<span class="tree-arrow">&nbsp;</span><span class="tree-label">${entry.name}</span>`;

          row.addEventListener("click", () => {
            this.setFocusedRow(row);
            this.onFileSelect?.(entry.path);
          });

          container.appendChild(row);
        }
      }
    } catch {
      const errEl = document.createElement("div");
      errEl.className = "tree-error";
      errEl.textContent = "Error loading";
      container.appendChild(errEl);
    }
  }

  private getVisibleRows(): HTMLElement[] {
    return Array.from(this.treeContainer.querySelectorAll(".tree-row")) as HTMLElement[];
  }

  private setFocusedRow(row: HTMLElement): void {
    this.treeContainer.querySelectorAll(".tree-row-active").forEach((el) => {
      el.classList.remove("tree-row-active");
    });
    row.classList.add("tree-row-active");
    this.focusedRow = row;
    row.scrollIntoView({ block: "nearest" });
  }

  private async handleKeyboard(e: KeyboardEvent): Promise<void> {
    const rows = this.getVisibleRows();
    if (rows.length === 0) return;

    const currentIdx = this.focusedRow ? rows.indexOf(this.focusedRow) : -1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = currentIdx < rows.length - 1 ? currentIdx + 1 : 0;
      this.setFocusedRow(rows[nextIdx]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : rows.length - 1;
      this.setFocusedRow(rows[prevIdx]);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (this.focusedRow?.dataset.type === "folder") {
        const dirPath = this.focusedRow.dataset.path!;
        if (!this.expandedDirs.has(dirPath)) {
          this.focusedRow.click();
        }
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (this.focusedRow?.dataset.type === "folder") {
        const dirPath = this.focusedRow.dataset.path!;
        if (this.expandedDirs.has(dirPath)) {
          this.focusedRow.click();
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this.focusedRow) {
        this.focusedRow.click();
      }
    }
  }
}
