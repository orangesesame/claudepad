import { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle, bracketMatching } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";

// Clear Dark theme for CodeMirror
const clearDarkTheme = EditorView.theme(
  {
    "&": {
      color: "#e0e0e0",
      backgroundColor: "#000000",
      fontFamily: '"SFMono-Regular", "SF Mono", "Menlo", "Consolas", monospace',
      fontSize: "12px",
    },
    ".cm-content": {
      caretColor: "#e0e0e0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#e0e0e0",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "#3b3b3b",
      },
    ".cm-panels": {
      backgroundColor: "#0a0a0a",
      color: "#e0e0e0",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid #1a1a1a",
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: "1px solid #1a1a1a",
    },
    ".cm-searchMatch": {
      backgroundColor: "#72a1ff59",
      outline: "1px solid #457dff",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "#6199ff2f",
    },
    ".cm-activeLine": {
      backgroundColor: "#0a0a0a",
    },
    ".cm-selectionMatch": {
      backgroundColor: "#aafe661a",
    },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "#bad0f847",
    },
    ".cm-gutters": {
      backgroundColor: "#000000",
      color: "#444",
      border: "none",
      borderRight: "1px solid #1a1a1a",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#0a0a0a",
      color: "#666",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "#666",
    },
    ".cm-tooltip": {
      border: "1px solid #1a1a1a",
      backgroundColor: "#0a0a0a",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "#0a0a0a",
      borderBottomColor: "#0a0a0a",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "#3b3b3b",
        color: "#e0e0e0",
      },
    },
  },
  { dark: true }
);

const clearDarkHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#c792ea" },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: "#e0e0e0" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#82aaff" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#f78c6c" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#e0e0e0" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#ffcb6b" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: "#89ddff" },
  { tag: [tags.meta, tags.comment], color: "#666666" },
  { tag: tags.strong, fontWeight: "bold", color: "#ededed" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#c3e88d" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#00a6b2", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#ededed" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#f78c6c" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#c3e88d" },
  { tag: tags.invalid, color: "#ff5370" },
]);

export class MarkdownEditor {
  private view: EditorView | null = null;
  private onChangeCallback: ((content: string) => void) | null = null;

  create(container: HTMLElement, content: string = ""): void {
    if (this.view) {
      this.view.destroy();
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && this.onChangeCallback) {
        this.onChangeCallback(update.state.doc.toString());
      }
    });

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      rectangularSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      bracketMatching(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      clearDarkTheme,
      syntaxHighlighting(clearDarkHighlighting),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      updateListener,
      EditorView.lineWrapping,
    ];

    this.view = new EditorView({
      state: EditorState.create({ doc: content, extensions }),
      parent: container,
    });
  }

  setContent(content: string): void {
    if (!this.view) return;
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content,
      },
    });
  }

  getContent(): string {
    return this.view?.state.doc.toString() ?? "";
  }

  onChange(callback: (content: string) => void): void {
    this.onChangeCallback = callback;
  }

  focus(): void {
    this.view?.focus();
  }

  destroy(): void {
    this.view?.destroy();
    this.view = null;
  }
}
