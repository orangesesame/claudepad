export class Splitter {
  private splitterEl: HTMLElement;
  private leftPane: HTMLElement;
  private rightPane: HTMLElement;
  private dragging = false;
  private onResize: (() => void) | null = null;

  constructor(
    splitterEl: HTMLElement,
    leftPane: HTMLElement,
    rightPane: HTMLElement
  ) {
    this.splitterEl = splitterEl;
    this.leftPane = leftPane;
    this.rightPane = rightPane;
    this.init();
  }

  private init(): void {
    this.splitterEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.dragging = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.dragging) return;

      const container = this.splitterEl.parentElement!;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const totalWidth = rect.width;
      const splitterWidth = this.splitterEl.offsetWidth;

      // Clamp between 200px and totalWidth - 200px
      const minLeft = 200;
      const maxLeft = totalWidth - 200 - splitterWidth;
      const leftWidth = Math.max(minLeft, Math.min(maxLeft, x));

      this.leftPane.style.width = `${leftWidth}px`;
      this.leftPane.style.flex = "none";

      this.onResize?.();
    });

    document.addEventListener("mouseup", () => {
      if (this.dragging) {
        this.dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        this.onResize?.();
      }
    });
  }

  setOnResize(callback: () => void): void {
    this.onResize = callback;
  }
}
