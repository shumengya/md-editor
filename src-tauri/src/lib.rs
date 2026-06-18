use std::sync::Mutex;
use tauri::{Manager, State};

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取失败: {}", e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content.as_bytes()).map_err(|e| format!("写入失败: {}", e))
}

// Windows-only: register right-click context menu for .md/.markdown files
#[cfg(target_os = "windows")]
#[tauri::command]
fn register_file_associations() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe_path.to_string_lossy();
    let cmd_value = format!("\"{}\" \"%1\"", exe_str);
    let menu_name = "使用MD编辑器打开";

    for ext in &["md", "markdown"] {
        let key = format!(
            "HKCU\\Software\\Classes\\.{}\\shell\\{}\\command",
            ext, menu_name
        );
        let status = std::process::Command::new("reg")
            .args(["add", &key, "/ve", "/d", &cmd_value, "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("注册 .{} 失败", ext));
        }
    }
    let _ = std::process::Command::new("ie4uinit.exe").arg("-show").status();
    Ok("注册成功".into())
}

// Stub for non-Windows platforms
#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn register_file_associations() -> Result<String, String> {
    Err("此功能仅支持 Windows".into())
}

struct OpenFilePath(Mutex<Option<String>>);

#[tauri::command]
fn get_open_file_path(state: State<OpenFilePath>) -> Option<String> {
    state.0.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(OpenFilePath(Mutex::new(None)))
        .setup(|app| {
            // CLI file argument (desktop only — mobile has no CLI args)
            #[cfg(not(target_os = "android"))]
            {
                let args: Vec<String> = std::env::args().collect();
                let file_arg = args.into_iter().skip(1).find(|a| {
                    !a.starts_with('-') && {
                        let p = std::path::Path::new(a);
                        p.exists()
                            && p.extension()
                                .map(|e| {
                                    matches!(
                                        e.to_str(),
                                        Some("md") | Some("markdown") | Some("txt")
                                    )
                                })
                                .unwrap_or(false)
                    }
                });
                if let Some(path) = file_arg {
                    *app.state::<OpenFilePath>().0.lock().unwrap() = Some(path);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_open_file_path,
            register_file_associations,
            read_text_file,
            write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
