import { readDir, DirEntry, readFile, writeFile, renameFile, Bookmark, saveBookmarks, loadBookmarks, saveLastFolder, listFilesByPrefix, listMdFilesByCreated, listMdFiles, FileEntry, FileWithTime } from "../commands";

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
  private onFileDoubleClick: ((path: string) => void) | null = null;
  private bookmarks: Bookmark[] = [];
  private bookmarkList: HTMLElement;
  private focusedRow: HTMLElement | null = null;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private dragSourcePath: string | null = null;
  private filterInput: HTMLInputElement;
  private filterQuery: string = "";
  private filterDebounce: ReturnType<typeof setTimeout> | null = null;
  private filterActive: boolean = false;

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
      <button id="btn-open-folder" title="Open Folder">Folder</button>
      <button id="btn-new-md" title="New .md file in current folder">.md</button>
      <button id="btn-new-daily" title="New daily note in 0.Daily Notes">+DN</button>
      <span class="explorer-separator">|</span>
      <button id="btn-list-26" title="List 26.* files in Norda (reverse order)">26.</button>
      <button id="btn-list-recent-md" title="Recent .md files in Norda">Recent</button>
    `;
    this.container.appendChild(header);

    // Filter bar
    const filterBar = document.createElement("div");
    filterBar.className = "explorer-filter";
    this.filterInput = document.createElement("input");
    this.filterInput.type = "text";
    this.filterInput.placeholder = "Filter files...";
    this.filterInput.className = "explorer-filter-input";
    const filterClear = document.createElement("span");
    filterClear.className = "explorer-filter-clear";
    filterClear.innerHTML = "&times;";
    filterClear.title = "Clear filter";
    filterClear.style.display = "none";
    filterClear.addEventListener("click", () => {
      this.filterInput.value = "";
      this.filterQuery = "";
      filterClear.style.display = "none";
      this.clearFilter();
      this.filterInput.focus();
    });
    this.filterInput.addEventListener("input", () => {
      this.filterQuery = this.filterInput.value.toLowerCase();
      filterClear.style.display = this.filterQuery ? "" : "none";
      if (this.filterDebounce) clearTimeout(this.filterDebounce);
      if (!this.filterQuery) {
        this.clearFilter();
        return;
      }
      this.filterDebounce = setTimeout(() => {
        this.applyNordaFilter(this.filterQuery);
      }, 300);
    });
    this.filterInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.filterInput.value = "";
        this.filterQuery = "";
        filterClear.style.display = "none";
        this.clearFilter();
      }
    });
    filterBar.appendChild(this.filterInput);
    filterBar.appendChild(filterClear);
    this.container.appendChild(filterBar);

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

    // Daily note button handler
    header.querySelector("#btn-new-daily")!.addEventListener("click", () => {
      this.createDailyNote().catch((err) => console.error("Daily note error:", err));
    });

    // 26.* files button handler
    header.querySelector("#btn-list-26")!.addEventListener("click", () => {
      this.showNordaFileList("26.").catch((err) => console.error("26. list error:", err));
    });

    // Recent .md files button handler
    header.querySelector("#btn-list-recent-md")!.addEventListener("click", () => {
      this.showRecentMdList().catch((err) => console.error("Recent md list error:", err));
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

  setOnFileDoubleClick(callback: (path: string) => void): void {
    this.onFileDoubleClick = callback;
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

    // Determine target folder from focused row
    let targetDir = this.rootPath;
    let insertAfterEl: HTMLElement | null = null;
    if (this.focusedRow) {
      if (this.focusedRow.dataset.type === "folder") {
        targetDir = this.focusedRow.dataset.path!;
        // Insert after the folder row's children container
        insertAfterEl = this.focusedRow.nextElementSibling as HTMLElement | null;
      } else if (this.focusedRow.dataset.path) {
        // File row — use its parent folder
        targetDir = this.focusedRow.dataset.path.substring(0, this.focusedRow.dataset.path.lastIndexOf("/"));
        insertAfterEl = this.focusedRow;
      }
    }

    const row = document.createElement("div");
    row.className = "tree-row tree-row-file";
    row.style.paddingLeft = "18px";

    const input = document.createElement("input");
    input.type = "text";
    input.value = "untitled.md";
    input.style.cssText = "background:var(--bg);color:var(--text);border:1px solid var(--accent);font-family:var(--font);font-size:12px;padding:0 4px;width:calc(100% - 8px);outline:none;border-radius:2px;height:20px;";
    row.appendChild(input);

    if (insertAfterEl && insertAfterEl.parentElement) {
      insertAfterEl.parentElement.insertBefore(row, insertAfterEl.nextSibling);
    } else {
      this.treeContainer.prepend(row);
    }
    input.focus();
    const dotIdx = input.value.lastIndexOf(".");
    input.setSelectionRange(0, dotIdx > 0 ? dotIdx : input.value.length);

    const commit = async () => {
      const name = input.value.trim();
      if (name && targetDir) {
        const fileName = name.endsWith(".md") ? name : name + ".md";
        const filePath = targetDir + "/" + fileName;
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

  private async createDailyNote(): Promise<void> {
    if (!this.rootPath) {
      console.error("createDailyNote: no rootPath");
      return;
    }

    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}.${mm}.${dd}`;

      const dirPath = this.rootPath + "/0.Daily Notes";
      const filePath = dirPath + "/" + dateStr + ".md";

      let exists = false;
      try {
        await readFile(filePath);
        exists = true;
      } catch {
        // File doesn't exist — will create
      }

      if (!exists) {
        const template = "# " + dateStr + "\n\n### Priorities for Today\n\n***\n\n* [ ] <br />\n\n<br />\n\n### Captured Actions\n\n***\n\n* [ ] <br />\n\n<br />\n\n### Stuff I Worked on Today\n\n***\n\n1. <br />\n\n<br />\n\n### General Notes\n\n***\n\n1. <br />\n";
        await writeFile(filePath, template);
      }

      this.expandedDirs.add(dirPath);
      await this.renderTree();
      this.onFileSelect?.(filePath);
    } catch (err) {
      console.error("createDailyNote failed:", err);
      alert("Failed to create daily note: " + err);
    }
  }

  private readonly NORDA_PATH = "/Users/philroberts/Library/CloudStorage/OneDrive-DigitalImpactVentureStudio/Norda";

  private showFileListPanel(title: string, items: { name: string; path: string; relative: string }[]): void {
    this.treeContainer.innerHTML = "";

    const header = document.createElement("div");
    header.className = "file-list-header";
    header.innerHTML = `<span class="file-list-title">${title}</span><span class="file-list-close" title="Back to tree">&times;</span>`;
    header.querySelector(".file-list-close")!.addEventListener("click", () => {
      this.renderTree();
    });
    this.treeContainer.appendChild(header);

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.style.height = "60px";
      empty.textContent = "No files found";
      this.treeContainer.appendChild(empty);
      return;
    }

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "tree-row tree-row-file";
      row.style.paddingLeft = "8px";
      row.dataset.path = item.path;
      row.innerHTML = `<span class="tree-arrow">&nbsp;</span><span class="tree-label" title="${item.relative}">${item.relative}</span>`;
      row.addEventListener("click", () => {
        this.setFocusedRow(row);
        this.onFileSelect?.(item.path);
      });
      row.addEventListener("dblclick", () => {
        if (item.name.endsWith(".md") && this.onFileDoubleClick) {
          this.onFileDoubleClick(item.path);
        } else {
          this.onFileSelect?.(item.path);
        }
      });
      this.treeContainer.appendChild(row);
    }
  }

  private async showNordaFileList(prefix: string): Promise<void> {
    const files = await listFilesByPrefix(this.NORDA_PATH, prefix);
    this.showFileListPanel(`Files: ${prefix}*`, files);
  }

  private async showRecentMdList(): Promise<void> {
    const files = await listMdFilesByCreated(this.NORDA_PATH);
    this.showFileListPanel("Recent .md files", files.map((f: FileWithTime) => ({
      name: f.name,
      path: f.path,
      relative: f.relative,
    })));
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

    // Drop target: allow files to be dropped onto folders
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", (e) => {
      // Only remove highlight when actually leaving the row, not entering a child
      const related = e.relatedTarget as Node | null;
      if (!related || !row.contains(related)) {
        row.classList.remove("drag-over");
      }
    });
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drag-over");
      const srcPath = this.dragSourcePath;
      if (!srcPath) return;
      const fileName = srcPath.split("/").pop()!;
      const destPath = dirPath + "/" + fileName;
      if (srcPath === destPath) return;
      try {
        await renameFile(srcPath, destPath);
        await this.renderTree();
      } catch (err) {
        console.error("Failed to move file:", err);
      }
    });

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

          // Drag source: allow files to be dragged
          row.draggable = true;
          row.addEventListener("dragstart", (e) => {
            this.dragSourcePath = entry.path;
            e.dataTransfer!.effectAllowed = "move";
            row.classList.add("dragging");
          });
          row.addEventListener("dragend", () => {
            row.classList.remove("dragging");
            this.dragSourcePath = null;
          });

          row.addEventListener("click", () => {
            this.setFocusedRow(row);
            if (this.clickTimer) clearTimeout(this.clickTimer);
            this.clickTimer = setTimeout(() => {
              this.onFileSelect?.(entry.path);
            }, 250);
          });

          row.addEventListener("dblclick", () => {
            if (this.clickTimer) {
              clearTimeout(this.clickTimer);
              this.clickTimer = null;
            }
            if (isMd && this.onFileDoubleClick) {
              this.onFileDoubleClick(entry.path);
            } else {
              this.onFileSelect?.(entry.path);
            }
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
    const allRows = Array.from(this.treeContainer.querySelectorAll(".tree-row")) as HTMLElement[];
    return allRows.filter((row) => {
      let el: HTMLElement | null = row.parentElement;
      while (el && el !== this.treeContainer) {
        if (el.classList.contains("tree-children") && el.style.display === "none") {
          return false;
        }
        el = el.parentElement;
      }
      return true;
    });
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

  private clearFilter(): void {
    if (this.filterActive) {
      this.filterActive = false;
      this.renderTree();
    }
  }

  private async applyNordaFilter(query: string): Promise<void> {
    try {
      const allFiles = await listMdFiles(this.NORDA_PATH);
      const matches = allFiles.filter((f: FileEntry) =>
        f.name.toLowerCase().includes(query) || f.relative.toLowerCase().includes(query)
      );
      // If query changed while we were fetching, ignore stale results
      if (this.filterQuery !== query) return;
      this.filterActive = true;
      this.showFileListPanel(`Filter: "${query}"`, matches);
    } catch (err) {
      console.error("Filter search error:", err);
    }
  }
}
