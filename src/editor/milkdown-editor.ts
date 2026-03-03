import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { replaceAll, insert, callCommand } from "@milkdown/kit/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { editorViewCtx } from "@milkdown/kit/core";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame-dark.css";

export class MilkdownEditor {
  private crepe: Crepe | null = null;
  private onChangeCallback: ((content: string) => void) | null = null;

  async create(container: HTMLElement, content: string = ""): Promise<void> {
    if (this.crepe) {
      await this.crepe.destroy();
      this.crepe = null;
    }

    // Clear container before mounting
    container.innerHTML = "";

    this.crepe = new Crepe({
      root: container,
      defaultValue: content,
      features: {
        [CrepeFeature.CodeMirror]: true,
        [CrepeFeature.ListItem]: true,
        [CrepeFeature.Toolbar]: true,
        [CrepeFeature.BlockEdit]: true,
        [CrepeFeature.LinkTooltip]: true,
        [CrepeFeature.Cursor]: true,
        [CrepeFeature.Placeholder]: true,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Table]: true,
        [CrepeFeature.Latex]: false,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: "Start writing...",
        },
      },
    });

    this.crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (this.onChangeCallback && markdown !== prevMarkdown) {
          this.onChangeCallback(markdown);
        }
      });
    });

    await this.crepe.create();
  }

  getContent(): string {
    return this.crepe?.getMarkdown() ?? "";
  }

  setContent(content: string): void {
    if (!this.crepe) return;
    this.crepe.editor.action(replaceAll(content));
  }

  onChange(callback: (content: string) => void): void {
    this.onChangeCallback = callback;
  }

  toggleBold(): void {
    if (!this.crepe) return;
    this.crepe.editor.action(callCommand(toggleStrongCommand.key));
  }

  toggleItalic(): void {
    if (!this.crepe) return;
    this.crepe.editor.action(callCommand(toggleEmphasisCommand.key));
  }

  setHeading(level: number): void {
    if (!this.crepe) return;
    this.crepe.editor.action(callCommand(wrapInHeadingCommand.key, level));
  }

  toggleBulletList(): void {
    if (!this.crepe) return;
    this.crepe.editor.action(callCommand(wrapInBulletListCommand.key));
  }

  toggleOrderedList(): void {
    if (!this.crepe) return;
    this.crepe.editor.action(callCommand(wrapInOrderedListCommand.key));
  }

  insertAtCursor(text: string): void {
    if (!this.crepe) return;
    this.crepe.editor.action(insert(text));
  }

  focus(): void {
    if (!this.crepe) return;
    this.crepe.editor.action((ctx) => {
      ctx.get(editorViewCtx).focus();
    });
  }

  async destroy(): Promise<void> {
    if (this.crepe) {
      await this.crepe.destroy();
      this.crepe = null;
    }
  }
}
