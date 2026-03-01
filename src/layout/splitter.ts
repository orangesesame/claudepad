export class Splitter {
  private splitterEl: HTMLElement;
  private leftPane: HTMLElement;
  private rightPane: HTMLElement;
  private dragging = false;
  private onResize: (() => void) | null = null;
  private minLeft: number;
  private minRight: number;

  constructor(
    splitterEl: HTMLElement,
    leftPane: HTMLElement,
    rightPane: HTMLElement,
    minLeft = 200,
    minRight = 200
  ) {
    this.splitterEl = splitterEl;
    this.leftPane = leftPane;
    this.rightPane = rightPane;
    this.minLeft = minLeft;
    this.minRight = minRight;
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

      const leftRect = this.leftPane.getBoundingClientRect();
      const x = e.clientX - leftRect.left;

      // Clamp: left pane can't go below minLeft, right pane keeps minRight
      const rightRect = this.rightPane.getBoundingClientRect();
      const available = leftRect.width + rightRect.width;
      const maxLeft = available - this.minRight;
      const leftWidth = Math.max(this.minLeft, Math.min(maxLeft, x));

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
