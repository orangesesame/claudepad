use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::ipc::Channel;

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    // Keep the child handle so the process stays alive
    _child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Clone, serde::Serialize)]
pub struct PtyData {
    id: String,
    data: Vec<u8>,
}

#[tauri::command]
pub fn create_pty(
    state: tauri::State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
    on_data: Channel<PtyData>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Get the user's default shell
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // login shell
    cmd.cwd(std::env::var("HOME").unwrap_or_else(|_| "/".to_string()));

    // Set TERM for proper terminal support
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Drop slave side - we only need the master
    drop(pair.slave);

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get reader: {}", e))?;

    let session = PtySession {
        master: pair.master,
        writer,
        _child: child,
    };

    let id_clone = id.clone();

    // Spawn a thread to read PTY output and send it to the frontend via Channel
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = PtyData {
                        id: id_clone.clone(),
                        data: buf[..n].to_vec(),
                    };
                    if on_data.send(data).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?
        .insert(id, session);

    Ok(())
}

#[tauri::command]
pub fn write_pty(
    state: tauri::State<'_, PtyManager>,
    id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if let Some(session) = sessions.get_mut(&id) {
        session
            .writer
            .write_all(&data)
            .map_err(|e| format!("Write error: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Flush error: {}", e))?;
    } else {
        return Err(format!("PTY session '{}' not found", id));
    }

    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    state: tauri::State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if let Some(session) = sessions.get(&id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize error: {}", e))?;
    } else {
        return Err(format!("PTY session '{}' not found", id));
    }

    Ok(())
}

#[tauri::command]
pub fn kill_pty(
    state: tauri::State<'_, PtyManager>,
    id: String,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    // Removing the session drops the master/writer/child, which kills the process
    sessions.remove(&id);

    Ok(())
}
