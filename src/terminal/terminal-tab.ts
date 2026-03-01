import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { createPty, writePty, resizePty, killPty, PtyData } from "../commands";

let idCounter = 0;

export class TerminalTab {
  readonly id: string;
  readonly label: string;
  readonly terminal: Terminal;
  private fitAddon: FitAddon;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private alive = true;

  constructor() {
    this.id = `term-${++idCounter}`;
    this.label = `Terminal ${idCounter}`;

    this.terminal = new Terminal({
      fontFamily: '"SFMono-Regular", "SF Mono", "Menlo", "Consolas", monospace',
      fontSize: 12,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      theme: {
        background: "#000000",
        foreground: "#e0e0e0",
        cursor: "#e0e0e0",
        selectionBackground: "#3b3b3b",
        black: "#000000",
        red: "#990000",
        green: "#00a600",
        yellow: "#999900",
        blue: "#0000b2",
        magenta: "#b200b2",
        cyan: "#00a6b2",
        white: "#bfbfbf",
        brightBlack: "#666666",
        brightRed: "#e50000",
        brightGreen: "#00d900",
        brightYellow: "#e5e500",
        brightBlue: "#0000ff",
        brightMagenta: "#e500e5",
        brightCyan: "#00e5e5",
        brightWhite: "#e5e5e5",
      },
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
  }

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.terminal.open(container);

    // Try WebGL renderer for performance
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      this.terminal.loadAddon(webgl);
    } catch {
      // Fall back to canvas renderer — that's fine
    }

    this.fit();

    const cols = this.terminal.cols;
    const rows = this.terminal.rows;

    // Wire terminal input to PTY
    this.terminal.onData((data) => {
      if (this.alive) {
        const bytes = Array.from(new TextEncoder().encode(data));
        writePty(this.id, bytes);
      }
    });

    // Handle binary data (for paste, etc.)
    this.terminal.onBinary((data) => {
      if (this.alive) {
        const bytes = Array.from(data, (ch) => ch.charCodeAt(0));
        writePty(this.id, bytes);
      }
    });

    // Create PTY with Channel for output
    await createPty(this.id, cols, rows, (msg: PtyData) => {
      if (this.alive) {
        this.terminal.write(new Uint8Array(msg.data));
      }
    });

    // Auto-resize when container changes
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(container);

    // Resize PTY when terminal dimensions change
    this.terminal.onResize(({ cols, rows }) => {
      if (this.alive) {
        resizePty(this.id, cols, rows);
      }
    });
  }

  fit(): void {
    try {
      this.fitAddon.fit();
    } catch {
      // Container might not be visible yet
    }
  }

  focus(): void {
    this.terminal.focus();
  }

  async dispose(): Promise<void> {
    this.alive = false;
    this.resizeObserver?.disconnect();
    this.terminal.dispose();
    await killPty(this.id).catch(() => {});
  }
}
