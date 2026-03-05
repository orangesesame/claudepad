use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use regex::Regex;
use walkdir::WalkDir;

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
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dirs for '{}': {}", path, e))?;
    }
    fs::write(&path, &contents).map_err(|e| format!("Failed to write '{}': {}", path, e))
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_path, new_path, e))
}

fn state_file() -> PathBuf {
    let mut p = dirs::home_dir().unwrap_or_default();
    p.push(".claudepad_state.json");
    p
}

fn read_state() -> serde_json::Value {
    let p = state_file();
    if !p.exists() {
        return serde_json::json!({});
    }
    fs::read_to_string(&p)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_state(v: &serde_json::Value) -> Result<(), String> {
    fs::write(state_file(), serde_json::to_string_pretty(v).unwrap())
        .map_err(|e| format!("Failed to save state: {}", e))
}

#[tauri::command]
pub fn save_last_folder(path: String) -> Result<(), String> {
    let mut state = read_state();
    state["lastFolder"] = serde_json::json!(path);
    write_state(&state)
}

#[tauri::command]
pub fn load_last_folder() -> Result<Option<String>, String> {
    let state = read_state();
    Ok(state.get("lastFolder").and_then(|v| v.as_str()).map(String::from))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Bookmark {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn save_bookmarks(bookmarks: Vec<Bookmark>) -> Result<(), String> {
    let mut state = read_state();
    state["bookmarks"] = serde_json::to_value(&bookmarks).unwrap();
    write_state(&state)
}

#[tauri::command]
pub fn load_bookmarks() -> Result<Vec<Bookmark>, String> {
    let state = read_state();
    match state.get("bookmarks") {
        Some(v) => serde_json::from_value(v.clone()).map_err(|e| e.to_string()),
        None => Ok(vec![]),
    }
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

#[derive(Serialize)]
pub struct TaskItem {
    pub text: String,
    pub heading: Option<String>,
}

#[derive(Serialize)]
pub struct TaskFile {
    pub filename: String,
    pub path: String,
    pub tasks: Vec<TaskItem>,
}

#[tauri::command]
pub fn collect_tasks(dir: String, filename_regex: Option<String>) -> Result<Vec<TaskFile>, String> {
    let re = filename_regex
        .as_deref()
        .map(|p| Regex::new(p).map_err(|e| format!("Invalid regex: {}", e)))
        .transpose()?;

    let mut results: Vec<TaskFile> = Vec::new();

    for entry in WalkDir::new(&dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.ends_with(".md") {
            continue;
        }
        // Skip hidden files/dirs
        if path.components().any(|c| {
            c.as_os_str().to_str().map_or(false, |s| s.starts_with('.'))
        }) {
            continue;
        }
        // Apply optional filename filter
        if let Some(ref re) = re {
            if !re.is_match(&name) {
                continue;
            }
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut tasks: Vec<TaskItem> = Vec::new();
        let mut current_heading: Option<String> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            // Track headings
            if trimmed.starts_with('#') {
                let heading_text = trimmed.trim_start_matches('#').trim().to_string();
                if !heading_text.is_empty() {
                    current_heading = Some(heading_text);
                }
            }
            // Match unchecked checkboxes: - [ ] or * [ ]
            if let Some(task_text) = trimmed.strip_prefix("- [ ] ")
                .or_else(|| trimmed.strip_prefix("* [ ] "))
            {
                tasks.push(TaskItem {
                    text: task_text.to_string(),
                    heading: current_heading.clone(),
                });
            }
        }

        if !tasks.is_empty() {
            results.push(TaskFile {
                filename: name,
                path: path.to_string_lossy().to_string(),
                tasks,
            });
        }
    }

    Ok(results)
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub relative: String,
}

#[tauri::command]
pub fn list_md_files(dir: String) -> Result<Vec<FileEntry>, String> {
    let base = std::path::Path::new(&dir);
    let mut files: Vec<FileEntry> = Vec::new();

    for entry in WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.ends_with(".md") {
            continue;
        }
        if path.components().any(|c| {
            c.as_os_str().to_str().map_or(false, |s| s.starts_with('.'))
        }) {
            continue;
        }
        let relative = path.strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());

        files.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            relative,
        });
    }

    files.sort_by(|a, b| a.relative.to_lowercase().cmp(&b.relative.to_lowercase()));
    Ok(files)
}

#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub relative: String,
    pub line_number: usize,
    pub line_text: String,
}

#[derive(Serialize)]
pub struct FileWithTime {
    pub name: String,
    pub path: String,
    pub relative: String,
    pub created_ms: u64,
}

/// Recursively list files whose name starts with a given prefix, sorted in reverse alphabetical order.
#[tauri::command]
pub fn list_files_by_prefix(dir: String, prefix: String) -> Result<Vec<FileEntry>, String> {
    let base = std::path::Path::new(&dir);
    let mut files: Vec<FileEntry> = Vec::new();

    for entry in WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if path.components().any(|c| {
            c.as_os_str().to_str().map_or(false, |s| s.starts_with('.'))
        }) {
            continue;
        }
        if !name.starts_with(&prefix) {
            continue;
        }
        let relative = path.strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());

        files.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            relative,
        });
    }

    // Reverse alphabetical order by name
    files.sort_by(|a, b| b.name.to_lowercase().cmp(&a.name.to_lowercase()));
    Ok(files)
}

/// List all .md files sorted by creation time (newest first).
#[tauri::command]
pub fn list_md_files_by_created(dir: String) -> Result<Vec<FileWithTime>, String> {
    let base = std::path::Path::new(&dir);
    let mut files: Vec<FileWithTime> = Vec::new();

    for entry in WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.ends_with(".md") {
            continue;
        }
        if path.components().any(|c| {
            c.as_os_str().to_str().map_or(false, |s| s.starts_with('.'))
        }) {
            continue;
        }
        let relative = path.strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());

        let created_ms = path.metadata()
            .and_then(|m| m.created())
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
            .unwrap_or(0);

        files.push(FileWithTime {
            name,
            path: path.to_string_lossy().to_string(),
            relative,
            created_ms,
        });
    }

    // Newest first
    files.sort_by(|a, b| b.created_ms.cmp(&a.created_ms));
    Ok(files)
}

#[tauri::command]
pub fn search_md_files(dir: String, query: String) -> Result<Vec<SearchResult>, String> {
    let base = std::path::Path::new(&dir);
    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for entry in WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.ends_with(".md") {
            continue;
        }
        if path.components().any(|c| {
            c.as_os_str().to_str().map_or(false, |s| s.starts_with('.'))
        }) {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let relative = path.strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());

        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                results.push(SearchResult {
                    path: path.to_string_lossy().to_string(),
                    relative: relative.clone(),
                    line_number: i + 1,
                    line_text: line.to_string(),
                });
            }
        }
    }

    Ok(results)
}
