use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl};

static CLAUDE_VIEW_CREATED: AtomicBool = AtomicBool::new(false);
static CLAUDE_VIEW_VISIBLE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn show_claude_view(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = app.get_window("main").ok_or("Main window not found")?;

    if CLAUDE_VIEW_CREATED.load(Ordering::Relaxed) {
        // Already created — move it back on-screen
        if let Some(wv) = window.get_webview("claude-chat") {
            wv.set_position(LogicalPosition::new(x, y))
                .map_err(|e| e.to_string())?;
            wv.set_size(LogicalSize::new(width, height))
                .map_err(|e| e.to_string())?;
        }
    } else {
        // Create it for the first time
        let url = "https://claude.ai".parse().unwrap();
        let builder =
            tauri::webview::WebviewBuilder::new("claude-chat", WebviewUrl::External(url));

        window
            .add_child(
                builder,
                LogicalPosition::new(x, y),
                LogicalSize::new(width, height),
            )
            .map_err(|e| e.to_string())?;

        CLAUDE_VIEW_CREATED.store(true, Ordering::Relaxed);
    }

    CLAUDE_VIEW_VISIBLE.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn hide_claude_view(app: tauri::AppHandle) -> Result<(), String> {
    if !CLAUDE_VIEW_CREATED.load(Ordering::Relaxed) {
        return Ok(());
    }
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(wv) = window.get_webview("claude-chat") {
        // Move off-screen and shrink to 0 to fully hide
        wv.set_position(LogicalPosition::new(-9999.0, -9999.0))
            .map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(1.0, 1.0))
            .map_err(|e| e.to_string())?;
    }
    CLAUDE_VIEW_VISIBLE.store(false, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn resize_claude_view(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if !CLAUDE_VIEW_VISIBLE.load(Ordering::Relaxed) {
        return Ok(());
    }
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(wv) = window.get_webview("claude-chat") {
        wv.set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
