use tauri::{Manager, Webview, WebviewBuilder, WebviewUrl};
use tauri::LogicalPosition;
use tauri::LogicalSize;

#[tauri::command]
pub async fn show_claude_view(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(wv) = app.get_webview("claude-view") {
        // Already exists — move into position
        wv.set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create child webview on the main window
    let win = app.get_window("main").ok_or("no main window")?;

    let webview = WebviewBuilder::new(
        "claude-view",
        WebviewUrl::External("https://claude.ai".parse().unwrap()),
    );

    win.add_child(
        webview,
        LogicalPosition::new(x, y),
        LogicalSize::new(width, height),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn hide_claude_view(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(wv) = app.get_webview("claude-view") {
        // Move off-screen and shrink
        wv.set_position(LogicalPosition::new(-9999.0_f64, -9999.0_f64))
            .map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(1.0_f64, 1.0_f64))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn copy_claude_to_clipboard(app: tauri::AppHandle) -> Result<(), String> {
    let wv: Webview = app.get_webview("claude-view").ok_or("Claude view not open")?;
    // Eval JS that finds the last assistant response and copies it to system clipboard
    wv.eval(r#"
        (() => {
            try {
                // Try multiple selectors for claude.ai message content
                let msgs = document.querySelectorAll('[class*="font-claude-message"]');
                if (!msgs.length) msgs = document.querySelectorAll('.prose');
                if (!msgs.length) msgs = document.querySelectorAll('[data-testid*="message"]');
                if (!msgs.length) msgs = document.querySelectorAll('[class*="message-content"]');
                if (!msgs.length) return;
                const last = msgs[msgs.length - 1];
                const text = last.innerText;
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            } catch(e) {}
        })()
    "#).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_clipboard() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}
