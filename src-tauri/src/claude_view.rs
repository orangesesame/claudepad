use tauri::Manager;

#[tauri::command]
pub async fn open_claude_window(app: tauri::AppHandle) -> Result<(), String> {
    // If already exists, just show and focus
    if let Some(win) = app.get_webview_window("claude-chat") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create a new WebviewWindow
    tauri::WebviewWindowBuilder::new(
        &app,
        "claude-chat",
        tauri::WebviewUrl::External("https://claude.ai".parse().unwrap()),
    )
    .title("Claude Chat")
    .inner_size(900.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn hide_claude_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("claude-chat") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
