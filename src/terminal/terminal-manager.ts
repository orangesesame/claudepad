import { TerminalTab } from "./terminal-tab";

export class TerminalManager {
  private tabs: TerminalTab[] = [];
  private activeTab: TerminalTab | null = null;
  private tabBar: HTMLElement;
  private container: HTMLElement;

  constructor(tabBar: HTMLElement, container: HTMLElement) {
    this.tabBar = tabBar;
    this.container = container;
  }

  async addTerminal(): Promise<TerminalTab> {
    const tab = new TerminalTab();
    this.tabs.push(tab);

    // Create tab element
    const tabEl = document.createElement("div");
    tabEl.className = "tab";
    tabEl.dataset.id = tab.id;
    tabEl.innerHTML = `
      <span class="tab-label">${tab.label}</span>
      <span class="tab-close">&times;</span>
    `;

    tabEl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("tab-close")) {
        this.closeTerminal(tab.id);
      } else {
        this.activateTerminal(tab.id);
      }
    });

    this.tabBar.appendChild(tabEl);

    // Create container div for this terminal
    const termDiv = document.createElement("div");
    termDiv.id = tab.id;
    termDiv.style.width = "100%";
    termDiv.style.height = "100%";
    termDiv.style.display = "none";
    this.container.appendChild(termDiv);

    // Mount and activate
    await tab.mount(termDiv);
    this.activateTerminal(tab.id);

    return tab;
  }

  activateTerminal(id: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    this.activeTab = tab;

    // Update tab bar
    this.tabBar.querySelectorAll(".tab").forEach((el) => {
      el.classList.toggle("active", (el as HTMLElement).dataset.id === id);
    });

    // Show/hide terminal containers
    for (const t of this.tabs) {
      const el = document.getElementById(t.id);
      if (el) {
        el.style.display = t.id === id ? "block" : "none";
      }
    }

    // Fit and focus the active terminal
    requestAnimationFrame(() => {
      tab.fit();
      tab.focus();
    });
  }

  async closeTerminal(id: string): Promise<void> {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const tab = this.tabs[idx];
    await tab.dispose();
    this.tabs.splice(idx, 1);

    // Remove DOM elements
    const tabEl = this.tabBar.querySelector(`[data-id="${id}"]`);
    tabEl?.remove();

    const termDiv = document.getElementById(id);
    termDiv?.remove();

    // Activate adjacent tab
    if (this.tabs.length > 0) {
      const newIdx = Math.min(idx, this.tabs.length - 1);
      this.activateTerminal(this.tabs[newIdx].id);
    } else {
      this.activeTab = null;
    }
  }

  activateByIndex(index: number): void {
    if (index >= 0 && index < this.tabs.length) {
      this.activateTerminal(this.tabs[index].id);
    }
  }

  getActive(): TerminalTab | null {
    return this.activeTab;
  }

  fitAll(): void {
    this.activeTab?.fit();
  }
}
