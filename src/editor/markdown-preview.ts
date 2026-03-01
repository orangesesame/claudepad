// Simple markdown-to-HTML renderer (no external dependency)
// Handles: headings, bold, italic, code, code blocks, links, lists, blockquotes, hr

export class MarkdownPreview {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(markdown: string): void {
    this.container.innerHTML = this.toHtml(markdown);
  }

  private toHtml(md: string): string {
    const lines = md.split("\n");
    const html: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let inList = false;
    let listType: "ul" | "ol" = "ul";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          html.push(`<pre><code>${this.escapeHtml(codeBlockContent.join("\n"))}</code></pre>`);
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          if (inList) { html.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Close list if needed
      const isListItem = /^(\s*[-*+]|\s*\d+\.)\s/.test(line);
      if (inList && !isListItem && line.trim() !== "") {
        html.push(listType === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }

      // Empty line
      if (line.trim() === "") {
        if (inList) {
          html.push(listType === "ul" ? "</ul>" : "</ol>");
          inList = false;
        }
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        html.push(`<h${level}>${this.inlineFormat(headingMatch[2])}</h${level}>`);
        continue;
      }

      // Horizontal rule
      if (/^(---|\*\*\*|___)\s*$/.test(line)) {
        html.push("<hr>");
        continue;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        html.push(`<blockquote>${this.inlineFormat(line.slice(2))}</blockquote>`);
        continue;
      }

      // Unordered list (including checkboxes)
      const ulMatch = line.match(/^\s*[-*+]\s+(.+)/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          if (inList) html.push("</ol>");
          html.push("<ul>");
          inList = true;
          listType = "ul";
        }
        let content = ulMatch[1];
        // Checkbox: - [ ] or - [x] / - [X]
        const cbMatch = content.match(/^\[([ xX])\]\s*(.*)/);
        if (cbMatch) {
          const checked = cbMatch[1] !== " " ? " checked" : "";
          html.push(`<li style="list-style:none;margin-left:-20px"><input type="checkbox" disabled${checked}> ${this.inlineFormat(cbMatch[2])}</li>`);
        } else {
          html.push(`<li>${this.inlineFormat(content)}</li>`);
        }
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^\s*\d+\.\s+(.+)/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          if (inList) html.push("</ul>");
          html.push("<ol>");
          inList = true;
          listType = "ol";
        }
        html.push(`<li>${this.inlineFormat(olMatch[1])}</li>`);
        continue;
      }

      // Paragraph
      html.push(`<p>${this.inlineFormat(line)}</p>`);
    }

    // Close any open blocks
    if (inCodeBlock) {
      html.push(`<pre><code>${this.escapeHtml(codeBlockContent.join("\n"))}</code></pre>`);
    }
    if (inList) {
      html.push(listType === "ul" ? "</ul>" : "</ol>");
    }

    return html.join("\n");
  }

  private inlineFormat(text: string): string {
    let result = this.escapeHtml(text);
    // Images
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">');
    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // Italic
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    result = result.replace(/_(.+?)_/g, "<em>$1</em>");
    // Strikethrough
    result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");
    // Inline code
    result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
    return result;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
