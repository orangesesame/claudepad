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
      color: "#00FF00",
      backgroundColor: "#000000",
      fontFamily: '"SFMono-Regular", "SF Mono", "Menlo", "Consolas", monospace',
      fontSize: "12px",
    },
    ".cm-content": {
      caretColor: "#00FF00",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#00FF00",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "#005500",
      },
    ".cm-panels": {
      backgroundColor: "#0a0a0a",
      color: "#00FF00",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid #00AA00",
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: "1px solid #00AA00",
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
      backgroundColor: "#004400",
    },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "#005500",
    },
    ".cm-gutters": {
      backgroundColor: "#000000",
      color: "#005500",
      border: "none",
      borderRight: "1px solid #00AA00",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#0a0a0a",
      color: "#00AA00",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "#007700",
    },
    ".cm-tooltip": {
      border: "1px solid #00AA00",
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
        backgroundColor: "#005500",
        color: "#00FF00",
      },
    },
  },
  { dark: true }
);

const clearDarkHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#33FF33" },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: "#00FF00" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#66FF66" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#00CC00" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#00FF00" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#99FF99" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: "#33FF33" },
  { tag: [tags.meta, tags.comment], color: "#005500" },
  { tag: tags.strong, fontWeight: "bold", color: "#33FF33" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#66FF66" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#33FF33", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#33FF33" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#00CC00" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#66FF66" },
  { tag: tags.invalid, color: "#FF0000" },
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

    const toggleCheckboxKeymap = keymap.of([
      {
        key: "Mod-Enter",
        run: (view) => {
          this.toggleCheckboxAtCursor();
          return true;
        },
      },
    ]);

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
      toggleCheckboxKeymap,
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

  /** Wrap selection with before/after markers (e.g. **bold**) */
  wrapSelection(before: string, after: string): void {
    if (!this.view) return;
    const { from, to } = this.view.state.selection.main;
    const selected = this.view.state.sliceDoc(from, to);
    this.view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + before.length, head: to + before.length },
    });
    this.view.focus();
  }

  /** Prefix each selected line (or current line) with a string */
  prefixLines(prefix: string): void {
    if (!this.view) return;
    const state = this.view.state;
    const { from, to } = state.selection.main;
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;

    const changes: { from: number; to: number; insert: string }[] = [];
    for (let i = startLine; i <= endLine; i++) {
      const line = state.doc.line(i);
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
    this.view.dispatch({ changes });
    this.view.focus();
  }

  /** Prefix lines with numbered list (1. 2. 3.) */
  numberedList(): void {
    if (!this.view) return;
    const state = this.view.state;
    const { from, to } = state.selection.main;
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;

    const changes: { from: number; to: number; insert: string }[] = [];
    let num = 1;
    for (let i = startLine; i <= endLine; i++) {
      const line = state.doc.line(i);
      changes.push({ from: line.from, to: line.from, insert: `${num}. ` });
      num++;
    }
    this.view.dispatch({ changes });
    this.view.focus();
  }

  toggleCheckboxAtCursor(): void {
    if (!this.view) return;
    const state = this.view.state;
    const pos = state.selection.main.head;
    const line = state.doc.lineAt(pos);
    const text = line.text;
    if (text.match(/^(\s*)- \[ \] /)) {
      this.view.dispatch({
        changes: { from: line.from, to: line.to, insert: text.replace("- [ ] ", "- [x] ") },
      });
    } else if (text.match(/^(\s*)- \[x\] /i)) {
      this.view.dispatch({
        changes: { from: line.from, to: line.to, insert: text.replace(/- \[[xX]\] /, "- [ ] ") },
      });
    }
  }

  toggleCheckboxAtLine(lineNumber: number): void {
    if (!this.view) return;
    const state = this.view.state;
    if (lineNumber < 1 || lineNumber > state.doc.lines) return;
    const line = state.doc.line(lineNumber);
    const text = line.text;
    if (text.match(/^(\s*)- \[ \] /)) {
      this.view.dispatch({
        changes: { from: line.from, to: line.to, insert: text.replace("- [ ] ", "- [x] ") },
      });
    } else if (text.match(/^(\s*)- \[x\] /i)) {
      this.view.dispatch({
        changes: { from: line.from, to: line.to, insert: text.replace(/- \[[xX]\] /, "- [ ] ") },
      });
    }
  }

  insertAtCursor(text: string): void {
    if (!this.view) return;
    const cursor = this.view.state.selection.main.head;
    this.view.dispatch({
      changes: { from: cursor, insert: text },
      selection: { anchor: cursor + text.length },
    });
    this.view.focus();
  }

  focus(): void {
    this.view?.focus();
  }

  destroy(): void {
    this.view?.destroy();
    this.view = null;
  }
}
