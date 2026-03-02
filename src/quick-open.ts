import { listMdFiles, FileEntry } from "./commands";

export class QuickOpen {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private resultsList: HTMLElement;
  private files: FileEntry[] = [];
  private filtered: FileEntry[] = [];
  private selectedIndex = 0;
  private onSelect: ((path: string) => void) | null = null;
  private visible = false;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.className = "quick-open-overlay hidden";
    this.overlay.innerHTML = `
      <div class="quick-open-panel">
        <input type="text" class="quick-open-input" placeholder="Search files...">
        <div class="quick-open-results"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.input = this.overlay.querySelector(".quick-open-input")!;
    this.resultsList = this.overlay.querySelector(".quick-open-results")!;

    this.input.addEventListener("input", () => this.filter());
    this.input.addEventListener("keydown", (e) => this.handleKey(e));
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  setOnSelect(callback: (path: string) => void): void {
    this.onSelect = callback;
  }

  async show(dir: string): Promise<void> {
    if (this.visible) {
      this.hide();
      return;
    }
    this.files = await listMdFiles(dir);
    this.input.value = "";
    this.selectedIndex = 0;
    this.filter();
    this.overlay.classList.remove("hidden");
    this.visible = true;
    this.input.focus();
  }

  hide(): void {
    this.overlay.classList.add("hidden");
    this.visible = false;
  }

  private filter(): void {
    const q = this.input.value.toLowerCase();
    this.filtered = q
      ? this.files.filter((f) => f.relative.toLowerCase().includes(q))
      : this.files;
    this.selectedIndex = 0;
    this.renderResults();
  }

  private renderResults(): void {
    this.resultsList.innerHTML = "";
    const show = this.filtered.slice(0, 50);
    show.forEach((file, i) => {
      const row = document.createElement("div");
      row.className = "quick-open-row" + (i === this.selectedIndex ? " selected" : "");
      row.textContent = file.relative;
      row.addEventListener("click", () => {
        this.onSelect?.(file.path);
        this.hide();
      });
      this.resultsList.appendChild(row);
    });
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.filtered.length - 1);
      this.renderResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.renderResults();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this.filtered[this.selectedIndex]) {
        this.onSelect?.(this.filtered[this.selectedIndex].path);
        this.hide();
      }
    } else if (e.key === "Escape") {
      this.hide();
    }
  }
}
