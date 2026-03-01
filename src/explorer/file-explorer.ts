import { readDir, DirEntry, writeFile } from "../commands";

export class FileExplorer {
  private container: HTMLElement;
  private treeContainer: HTMLElement;
  private rootPath: string | null = null;
  private expandedDirs: Set<string> = new Set();
  private onFileSelect: ((path: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

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

    // New .md button handler
    header.querySelector("#btn-new-md")!.addEventListener("click", () => {
      this.promptNewFile();
    });
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

  private async promptNewFile(): Promise<void> {
    if (!this.rootPath) return;

    const name = window.prompt("File name:", "untitled.md");
    if (!name) return;

    const fileName = name.endsWith(".md") ? name : name + ".md";
    const filePath = this.rootPath + "/" + fileName;

    await writeFile(filePath, "");
    await this.renderTree();
    this.onFileSelect?.(filePath);
  }

  private async renderTree(): Promise<void> {
    if (!this.rootPath) return;
    this.treeContainer.innerHTML = "";
    await this.buildFolder(this.rootPath, this.treeContainer, 0);
  }

  private async buildFolder(dirPath: string, parent: HTMLElement, depth: number): Promise<void> {
    const isExpanded = this.expandedDirs.has(dirPath);
    const label = dirPath.split("/").pop() || dirPath;

    // Folder row
    const row = document.createElement("div");
    row.className = "tree-row tree-row-folder";
    row.style.paddingLeft = `${depth * 14 + 4}px`;
    row.innerHTML = `<span class="tree-arrow">${isExpanded ? "&#9660;" : "&#9654;"}</span><span class="tree-label">${label}</span>`;
    parent.appendChild(row);

    // Children container
    const childrenEl = document.createElement("div");
    childrenEl.className = "tree-children";
    if (!isExpanded) childrenEl.style.display = "none";
    parent.appendChild(childrenEl);

    // Click to expand/collapse
    row.addEventListener("click", async () => {
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

    // Load children if expanded
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
          row.className = "tree-row tree-row-file";
          row.style.paddingLeft = `${depth * 14 + 4}px`;
          row.innerHTML = `<span class="tree-arrow">&nbsp;</span><span class="tree-label">${entry.name}</span>`;

          row.addEventListener("click", () => {
            // Remove active class from all rows
            this.treeContainer.querySelectorAll(".tree-row-active").forEach((el) => {
              el.classList.remove("tree-row-active");
            });
            row.classList.add("tree-row-active");
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
}
