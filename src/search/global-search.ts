import { searchMdFiles, SearchResult } from "../commands";

export class GlobalSearch {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private resultsList: HTMLElement;
  private results: SearchResult[] = [];
  private onSelect: ((path: string) => void) | null = null;
  private visible = false;
  private currentDir: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private selectedIndex = -1;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.className = "quick-open-overlay hidden";
    this.overlay.innerHTML = `
      <div class="quick-open-panel global-search-panel">
        <input type="text" class="quick-open-input" placeholder="Search in files...">
        <div class="quick-open-results"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.input = this.overlay.querySelector(".quick-open-input")!;
    this.resultsList = this.overlay.querySelector(".quick-open-results")!;

    this.input.addEventListener("input", () => this.debouncedSearch());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hide();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const max = Math.min(this.results.length, 100) - 1;
        if (this.selectedIndex < max) {
          this.selectedIndex++;
          this.highlightSelected();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.highlightSelected();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const show = this.results.slice(0, 100);
        if (this.selectedIndex >= 0 && this.selectedIndex < show.length) {
          this.onSelect?.(show[this.selectedIndex].path);
          this.hide();
        }
      }
    });
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  setOnSelect(callback: (path: string) => void): void {
    this.onSelect = callback;
  }

  show(dir: string): void {
    if (this.visible) {
      this.hide();
      return;
    }
    this.currentDir = dir;
    this.input.value = "";
    this.results = [];
    this.resultsList.innerHTML = "";
    this.overlay.classList.remove("hidden");
    this.visible = true;
    this.input.focus();
  }

  hide(): void {
    this.overlay.classList.add("hidden");
    this.visible = false;
  }

  private debouncedSearch(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.search(), 300);
  }

  private async search(): Promise<void> {
    const q = this.input.value.trim();
    if (!q || !this.currentDir) {
      this.resultsList.innerHTML = "";
      return;
    }
    this.results = await searchMdFiles(this.currentDir, q);
    this.selectedIndex = this.results.length > 0 ? 0 : -1;
    this.renderResults();
  }

  private renderResults(): void {
    this.resultsList.innerHTML = "";
    const show = this.results.slice(0, 100);
    for (const r of show) {
      const row = document.createElement("div");
      row.className = "quick-open-row search-result-row";
      row.innerHTML = `<span class="search-file">${this.escapeHtml(r.relative)}:${r.line_number}</span> <span class="search-text">${this.escapeHtml(r.line_text.trim())}</span>`;
      row.addEventListener("click", () => {
        this.onSelect?.(r.path);
        this.hide();
      });
      this.resultsList.appendChild(row);
    }
    if (this.results.length === 0) {
      this.resultsList.innerHTML = '<div class="quick-open-row" style="color:#005500">No results</div>';
    } else {
      this.highlightSelected();
    }
  }

  private highlightSelected(): void {
    const rows = this.resultsList.querySelectorAll(".search-result-row");
    rows.forEach((row, i) => {
      (row as HTMLElement).classList.toggle("selected", i === this.selectedIndex);
    });
    rows[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
