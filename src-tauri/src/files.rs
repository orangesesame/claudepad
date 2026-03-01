use std::fs;
use serde::Serialize;

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, &contents).map_err(|e| format!("Failed to write '{}': {}", path, e))
}

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries: Vec<DirEntry> = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read dir '{}': {}", path, e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden files/folders
            if name.starts_with('.') {
                return None;
            }
            let path = entry.path().to_string_lossy().to_string();
            let is_dir = entry.file_type().ok()?.is_dir();
            Some(DirEntry { name, path, is_dir })
        })
        .collect();
    // Sort: folders first, then alphabetical
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}
