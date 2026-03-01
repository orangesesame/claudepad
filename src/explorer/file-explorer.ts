import { readDir, DirEntry } from "../commands";

export class FileExplorer {
  private container: HTMLElement;
  private treeContainer: HTMLElement;
  private rootPath: string | null = null;
  private expandedDirs: Set<string> = new Set();
  private onFileSelect: ((path: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Header with open folder button
    const header = document.createElement("div");
    header.className = "explorer-header";
    header.innerHTML = `<button id="btn-open-folder" title="Open Folder">Open Folder</button>`;
    this.container.appendChild(header);

    // Tree container
    this.treeContainer = document.createElement("div");
    this.treeContainer.className = "explorer-tree";
    this.container.appendChild(this.treeContainer);

    // Empty state
    this.treeContainer.innerHTML = '<div class="empty-state">No folder open</div>';
  }

  setOnFileSelect(callback: (path: string) => void): void {
    this.onFileSelect = callback;
  }

  async openFolder(path: string): Promise<void> {
    this.rootPath = path;
    this.expandedDirs.clear();
    this.expandedDirs.add(path);
    await this.renderTree();
  }

  private async renderTree(): Promise<void> {
    if (!this.rootPath) return;
    this.treeContainer.innerHTML = "";

    const rootLabel = this.rootPath.split("/").pop() || this.rootPath;
    const rootEl = document.createElement("div");
    rootEl.className = "tree-item tree-folder expanded";
    rootEl.dataset.path = this.rootPath;
    rootEl.innerHTML = `<span class="tree-arrow">&#9660;</span><span class="tree-label">${rootLabel}</span>`;

    rootEl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".tree-children")) return;
      this.toggleDir(this.rootPath!, rootEl);
    });

    this.treeContainer.appendChild(rootEl);

    const children = document.createElement("div");
    children.className = "tree-children";
    rootEl.appendChild(children);

    await this.loadChildren(this.rootPath, children);
  }

  private async loadChildren(dirPath: string, container: HTMLElement): Promise<void> {
    try {
      const entries = await readDir(dirPath);
      container.innerHTML = "";

      for (const entry of entries) {
        const el = document.createElement("div");
        el.className = `tree-item ${entry.is_dir ? "tree-folder" : "tree-file"}`;
        el.dataset.path = entry.path;

        if (entry.is_dir) {
          const isExpanded = this.expandedDirs.has(entry.path);
          if (isExpanded) el.classList.add("expanded");
          el.innerHTML = `<span class="tree-arrow">${isExpanded ? "&#9660;" : "&#9654;"}</span><span class="tree-label">${entry.name}</span>`;

          const children = document.createElement("div");
          children.className = "tree-children";
          if (!isExpanded) children.style.display = "none";
          el.appendChild(children);

          if (isExpanded) {
            await this.loadChildren(entry.path, children);
          }

          el.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            if (target.closest(".tree-children")) return;
            e.stopPropagation();
            this.toggleDir(entry.path, el);
          });
        } else {
          el.innerHTML = `<span class="tree-arrow">&nbsp;</span><span class="tree-label">${entry.name}</span>`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            this.onFileSelect?.(entry.path);
          });
        }

        container.appendChild(el);
      }
    } catch (err) {
      container.innerHTML = `<div class="tree-error">Error loading</div>`;
    }
  }

  private async toggleDir(path: string, el: HTMLElement): Promise<void> {
    const children = el.querySelector(":scope > .tree-children") as HTMLElement;
    const arrow = el.querySelector(":scope > .tree-arrow") as HTMLElement;
    if (!children || !arrow) return;

    if (this.expandedDirs.has(path)) {
      this.expandedDirs.delete(path);
      el.classList.remove("expanded");
      children.style.display = "none";
      arrow.innerHTML = "&#9654;";
    } else {
      this.expandedDirs.add(path);
      el.classList.add("expanded");
      children.style.display = "";
      arrow.innerHTML = "&#9660;";
      await this.loadChildren(path, children);
    }
  }
}
