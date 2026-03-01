use tauri::{Manager, WebviewBuilder, WebviewUrl};
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
    )
    .auto_resize();

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
