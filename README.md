# ClaudePad

A minimal, terminal-first desktop IDE built for a specific workflow: terminal + markdown editing + Claude Code integration. Pure black, all monospace, no visual clutter.

Built with **Tauri v2** (Rust backend + TypeScript frontend) for a lightweight native macOS app.

## Screenshot Layout

```
┌──────────────────────────────────────────────────┐
│  [Open] [New] [Save] [Preview]      [+ Term]     │
├────────────────────┬─────────────────────────────┤
│                    │  ┌─ Terminal 1 ─┬─ Term 2 ─┐│
│   Markdown Editor  │  │                          ││
│   (CodeMirror 6)   │  │   xterm.js               ││
│                    │  │   (full PTY)              ││
│                    │  │                          ││
│                    │  │   claude (in any tab)    ││
│                    │  │                          ││
├────────────────────┤  └──────────────────────────┘│
│  file tabs         │                              │
└────────────────────┴─────────────────────────────┘
         ↕ draggable splitter
```

## Features

- **Terminal** — Full PTY via `portable-pty` crate, streamed to xterm.js via Tauri Channels. Multiple tabs.
- **Markdown Editor** — CodeMirror 6 with syntax highlighting, toggle-able rendered preview. Multiple file tabs.
- **Draggable Splitter** — Resize panes freely.
- **Clear Dark Theme** — Pure black background, #E0E0E0 text, SFMono font. Matches the macOS "Clear Dark" terminal profile.
- **Claude Code** — Open a terminal tab, type `claude`, and it just works.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust + WebView) |
| Frontend | Vanilla TypeScript + Vite |
| Terminal emulator | xterm.js + addon-fit + addon-webgl |
| PTY backend | `portable-pty` crate |
| Rust-to-JS streaming | Tauri v2 Channels |
| Markdown editor | CodeMirror 6 |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New terminal tab |
| `Cmd+O` | Open markdown file |
| `Cmd+S` | Save current file |
| `Cmd+P` | Toggle markdown preview |
| `Cmd+1-9` | Switch terminal tabs |

## Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+
# Xcode Command Line Tools
xcode-select --install
```

## Build & Run

```bash
npm install
npx tauri build --bundles app
open src-tauri/target/release/bundle/macos/ClaudePad.app
```

For development with hot reload:

```bash
npx tauri dev
```

## Project Structure

```
claudepad/
├── src/                          # TypeScript frontend
│   ├── main.ts                   # App entry, layout init, keyboard shortcuts
│   ├── style.css                 # Clear Dark theme
│   ├── commands.ts               # Tauri invoke wrappers
│   ├── terminal/
│   │   ├── terminal-manager.ts   # Multi-tab terminal management
│   │   └── terminal-tab.ts       # xterm.js + PTY wrapper
│   ├── editor/
│   │   ├── editor-manager.ts     # File tabs, open/save
│   │   ├── markdown-editor.ts    # CodeMirror 6 setup + theme
│   │   └── markdown-preview.ts   # Markdown-to-HTML renderer
│   └── layout/
│       └── splitter.ts           # Draggable pane divider
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── lib.rs                # Tauri setup, plugin/command registration
│       ├── main.rs               # Entry point
│       ├── pty.rs                # PTY session management (create/write/resize/kill)
│       └── files.rs              # File read/write commands
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
