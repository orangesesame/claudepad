import { TerminalTab } from "./terminal-tab";
import { showClaudeView, hideClaudeView } from "../commands";

export class TerminalManager {
  private tabs: TerminalTab[] = [];
  private activeTab: TerminalTab | null = null;
  private activeId: string | null = null;
  private tabBar: HTMLElement;
  private container: HTMLElement;
  private claudeId: string | null = null;

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
        this.activate(tab.id);
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
    this.activate(tab.id);

    return tab;
  }

  addClaudeTab(): void {
    // If Claude tab already exists, just activate it
    if (this.claudeId) {
      this.activate(this.claudeId);
      return;
    }

    const id = "claude-tab";
    this.claudeId = id;

    // Create tab element
    const tabEl = document.createElement("div");
    tabEl.className = "tab";
    tabEl.dataset.id = id;
    tabEl.innerHTML = `
      <span class="tab-label">Claude</span>
      <span class="tab-close">&times;</span>
    `;

    tabEl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("tab-close")) {
        this.closeClaudeTab();
      } else {
        this.activate(id);
      }
    });

    this.tabBar.appendChild(tabEl);
    this.activate(id);
  }

  private async closeClaudeTab(): Promise<void> {
    if (!this.claudeId) return;

    const tabEl = this.tabBar.querySelector(`[data-id="${this.claudeId}"]`);
    tabEl?.remove();

    const wasActive = this.activeId === this.claudeId;
    this.claudeId = null;

    // Hide the native webview
    try {
      await hideClaudeView();
    } catch { /* may not exist */ }

    if (wasActive) {
      if (this.tabs.length > 0) {
        this.activate(this.tabs[0].id);
      } else {
        this.activeId = null;
        this.activeTab = null;
      }
    }
  }

  activate(id: string): void {
    this.activeId = id;

    const termTab = this.tabs.find((t) => t.id === id);
    this.activeTab = termTab || null;

    // Update tab bar highlights
    this.tabBar.querySelectorAll(".tab").forEach((el) => {
      el.classList.toggle("active", (el as HTMLElement).dataset.id === id);
    });

    // Hide all terminal panes
    for (const t of this.tabs) {
      const el = document.getElementById(t.id);
      if (el) el.style.display = "none";
    }

    if (id === this.claudeId) {
      // Show Claude webview over the container
      this.positionClaudeView();
    } else {
      // Hide Claude webview
      hideClaudeView().catch(() => {});

      // Show the selected terminal
      const activeEl = document.getElementById(id);
      if (activeEl) activeEl.style.display = "block";

      if (termTab) {
        requestAnimationFrame(() => {
          termTab.fit();
          termTab.focus();
        });
      }
    }
  }

  private positionClaudeView(): void {
    const rect = this.container.getBoundingClientRect();
    showClaudeView(rect.x, rect.y, rect.width, rect.height).catch((err) => {
      console.error("Failed to show Claude view:", err);
    });
  }

  async closeTerminal(id: string): Promise<void> {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const tab = this.tabs[idx];
    await tab.dispose();
    this.tabs.splice(idx, 1);

    const tabEl = this.tabBar.querySelector(`[data-id="${id}"]`);
    tabEl?.remove();

    const termDiv = document.getElementById(id);
    termDiv?.remove();

    if (this.activeId === id) {
      if (this.tabs.length > 0) {
        const newIdx = Math.min(idx, this.tabs.length - 1);
        this.activate(this.tabs[newIdx].id);
      } else if (this.claudeId) {
        this.activate(this.claudeId);
      } else {
        this.activeTab = null;
        this.activeId = null;
      }
    }
  }

  activateByIndex(index: number): void {
    if (index >= 0 && index < this.tabs.length) {
      this.activate(this.tabs[index].id);
    }
  }

  getActive(): TerminalTab | null {
    return this.activeTab;
  }

  fitAll(): void {
    if (this.activeId === this.claudeId) {
      this.positionClaudeView();
    } else {
      this.activeTab?.fit();
    }
  }
}
