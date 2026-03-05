mod pty;
mod files;
mod claude_view;
mod new_window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize PTY manager as app state
            app.manage(pty::PtyManager::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::create_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
            files::read_file,
            files::write_file,
            files::rename_file,
            files::read_dir,
            files::save_last_folder,
            files::load_last_folder,
            claude_view::show_claude_view,
            claude_view::hide_claude_view,
            claude_view::copy_claude_to_clipboard,
            claude_view::read_clipboard,
            files::collect_tasks,
            files::save_bookmarks,
            files::load_bookmarks,
            files::list_md_files,
            files::search_md_files,
            files::list_files_by_prefix,
            files::list_md_files_by_created,
            new_window::open_file_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClaudePad");
}
