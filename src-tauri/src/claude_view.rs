use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl};

static CLAUDE_VIEW_EXISTS: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn toggle_claude_view(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<bool, String> {
    // If the webview already exists, toggle its visibility
    if let Some(webview) = app.webview_windows().get("claude-chat") {
        let visible = webview.is_visible().unwrap_or(false);
        if visible {
            webview.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            webview.show().map_err(|e| e.to_string())?;
            webview.set_focus().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else if CLAUDE_VIEW_EXISTS.load(Ordering::Relaxed) {
        // Child webview (not a window) — look for it on the main window
        let window = app
            .get_window("main")
            .ok_or("Main window not found")?;

        if let Some(wv) = window.get_webview("claude-chat") {
            // Reposition and show
            wv.set_position(LogicalPosition::new(x, y))
                .map_err(|e| e.to_string())?;
            wv.set_size(LogicalSize::new(width, height))
                .map_err(|e| e.to_string())?;
            Ok(true)
        } else {
            CLAUDE_VIEW_EXISTS.store(false, Ordering::Relaxed);
            create_child_webview(&app, x, y, width, height)
        }
    } else {
        create_child_webview(&app, x, y, width, height)
    }
}

fn create_child_webview(
    app: &tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<bool, String> {
    let window = app
        .get_window("main")
        .ok_or("Main window not found")?;

    let url = "https://claude.ai".parse().unwrap();
    let builder = tauri::webview::WebviewBuilder::new("claude-chat", WebviewUrl::External(url));

    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;

    CLAUDE_VIEW_EXISTS.store(true, Ordering::Relaxed);
    Ok(true)
}

#[tauri::command]
pub async fn resize_claude_view(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(wv) = window.get_webview("claude-chat") {
        wv.set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_claude_view(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(wv) = window.get_webview("claude-chat") {
        // Move off-screen to hide (child webviews don't have show/hide)
        wv.set_position(LogicalPosition::new(-9999.0, -9999.0))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
