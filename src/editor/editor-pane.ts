import { MilkdownEditor } from "./milkdown-editor";

export class EditorPane {
  public id: string;
  public editor: MilkdownEditor;
  public editorContainer: HTMLElement;
  public rootEl: HTMLElement;
  public activeTabId: string | null = null;

  constructor(id: string) {
    this.id = id;

    this.rootEl = document.createElement("div");
    this.rootEl.className = "editor-pane-panel";
    this.rootEl.dataset.paneId = id;

    this.editorContainer = document.createElement("div");
    this.editorContainer.className = "pane-editor-container";

    this.rootEl.appendChild(this.editorContainer);

    this.editor = new MilkdownEditor();
  }

  setFocused(focused: boolean): void {
    this.rootEl.classList.toggle("pane-focused", focused);
  }

  async destroy(): Promise<void> {
    await this.editor.destroy();
    this.rootEl.remove();
  }
}
