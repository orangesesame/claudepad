import { TerminalTab } from "./terminal-tab";

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

    // Create iframe container
    const div = document.createElement("div");
    div.id = id;
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.display = "none";

    const iframe = document.createElement("iframe");
    iframe.src = "https://claude.ai";
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    div.appendChild(iframe);

    this.container.appendChild(div);
    this.activate(id);
  }

  private closeClaudeTab(): void {
    if (!this.claudeId) return;

    const tabEl = this.tabBar.querySelector(`[data-id="${this.claudeId}"]`);
    tabEl?.remove();

    const div = document.getElementById(this.claudeId);
    div?.remove();

    const wasActive = this.activeId === this.claudeId;
    this.claudeId = null;

    if (wasActive) {
      // Activate first terminal tab
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

    // Find terminal tab if it's a terminal
    const termTab = this.tabs.find((t) => t.id === id);
    this.activeTab = termTab || null;

    // Update tab bar highlights
    this.tabBar.querySelectorAll(".tab").forEach((el) => {
      el.classList.toggle("active", (el as HTMLElement).dataset.id === id);
    });

    // Hide all panes (terminals + claude)
    for (const t of this.tabs) {
      const el = document.getElementById(t.id);
      if (el) el.style.display = "none";
    }
    if (this.claudeId) {
      const claudeEl = document.getElementById(this.claudeId);
      if (claudeEl) claudeEl.style.display = "none";
    }

    // Show the selected pane
    const activeEl = document.getElementById(id);
    if (activeEl) activeEl.style.display = "block";

    // Fit and focus if it's a terminal
    if (termTab) {
      requestAnimationFrame(() => {
        termTab.fit();
        termTab.focus();
      });
    }
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

    // Activate adjacent tab if this was active
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
    this.activeTab?.fit();
  }
}
