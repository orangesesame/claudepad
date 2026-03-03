use tauri::Manager;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_file_window(app: tauri::AppHandle, path: String) -> Result<(), String> {
    // Create a unique label from the file path
    let label = format!(
        "file-{}",
        path.replace("/", "-")
            .replace(".", "_")
            .replace(" ", "_")
    );

    // If window already exists, focus it
    if let Some(win) = app.get_webview_window(&label) {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let filename = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("File");

    let encoded_path = path.replace(" ", "%20");
    let url = format!("index.html?file={}", encoded_path);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(format!("ClaudePad - {}", filename))
        .inner_size(900.0, 700.0)
        .min_inner_size(400.0, 300.0)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
