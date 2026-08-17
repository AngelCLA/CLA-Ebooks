use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerationRequest {
    pdf_path: String,
    title: String,
    quality: String,
    sound_enabled: bool,
    background_path: Option<String>,
    output_path: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfInfo {
    page_count: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GenerationProgress {
    percent: u8,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerationResult {
    output_path: String,
    zip_path: String,
    page_count: u32,
    size_bytes: u64,
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarResult {
    output_path: String,
    zip_path: String,
    page_count: u32,
    size_bytes: u64,
    name: String,
}

struct GeneratorResources {
    template_dir: PathBuf,
    sound: PathBuf,
    fonts_dir: PathBuf,
    script_or_binary: PathBuf,
    use_python: bool,
}

struct PreviewServer {
    port: u16,
    directories: Mutex<HashMap<String, PathBuf>>,
}

static PREVIEW_SERVER: OnceLock<PreviewServer> = OnceLock::new();

fn preview_server() -> Result<&'static PreviewServer, String> {
    if let Some(server) = PREVIEW_SERVER.get() {
        return Ok(server);
    }
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("No se pudo iniciar la vista previa: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let server = PreviewServer {
        port,
        directories: Mutex::new(HashMap::new()),
    };
    PREVIEW_SERVER
        .set(server)
        .map_err(|_| "No se pudo iniciar la vista previa.".to_string())?;
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            serve_preview_request(stream);
        }
    });
    PREVIEW_SERVER
        .get()
        .ok_or("No se pudo iniciar la vista previa.".into())
}

fn serve_preview_request(mut stream: TcpStream) {
    let mut request = [0_u8; 4096];
    let Ok(read) = stream.read(&mut request) else {
        return;
    };
    let request = String::from_utf8_lossy(&request[..read]);
    let Some(target) = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
    else {
        return;
    };
    let target = target.split('?').next().unwrap_or("/");
    let mut segments = target.trim_start_matches('/').split('/');
    let Some(token) = segments.next() else { return };
    let relative = segments.collect::<Vec<_>>().join("/");
    let root = PREVIEW_SERVER
        .get()
        .and_then(|server| server.directories.lock().ok()?.get(token).cloned());
    let Some(root) = root else {
        return respond_preview(&mut stream, "404 Not Found", "text/plain", b"No encontrado");
    };
    let relative = if relative.is_empty() {
        "index.html"
    } else {
        &relative
    };
    let path = Path::new(relative);
    if path.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return respond_preview(&mut stream, "403 Forbidden", "text/plain", b"No permitido");
    }
    match fs::read(root.join(path)) {
        Ok(bytes) => respond_preview(&mut stream, "200 OK", preview_content_type(path), &bytes),
        Err(_) => respond_preview(&mut stream, "404 Not Found", "text/plain", b"No encontrado"),
    }
}

fn preview_content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
    {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "webp" => "image/webp",
        "mp3" => "audio/mpeg",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn respond_preview(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8]) {
    let header = format!("HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", body.len());
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must be inside the project")
        .to_path_buf()
}

fn generator_resources(app: &AppHandle) -> Result<GeneratorResources, String> {
    let root = project_root();
    let development_template = root.join("resources/ebook-template");
    // Python solo es un apoyo para `tauri dev`. Las versiones instalables siempre
    // deben usar el sidecar empaquetado, incluso en el equipo de desarrollo.
    if cfg!(debug_assertions) && development_template.is_dir() {
        return Ok(GeneratorResources {
            template_dir: development_template,
            sound: root.join("resources/page-turn.mp3"),
            fonts_dir: root.join("node_modules/@fontsource/ibm-plex-mono/files"),
            script_or_binary: root.join("src-tauri/sidecar/generator.py"),
            use_python: true,
        });
    }

    let current_executable_dir = std::env::current_exe()
        .map_err(|error| {
            format!("No se pudo localizar el ejecutable de CLA Ebooks Creator: {error}")
        })?
        .parent()
        .map(Path::to_path_buf)
        .ok_or("No se pudo localizar la carpeta de CLA Ebooks Creator.")?;
    let resources = app.path().resource_dir().map_err(|error| {
        format!("No se pudieron localizar los recursos de la aplicación: {error}")
    })?;
    let sidecar_names = [
        "ebook-generator",
        "ebook-generator.exe",
        "ebook-generator-x86_64-pc-windows-msvc.exe",
        "ebook-generator-aarch64-pc-windows-msvc.exe",
        "ebook-generator-x86_64-apple-darwin",
        "ebook-generator-aarch64-apple-darwin",
    ];
    let mut sidecar_candidates = Vec::new();
    for directory in [
        Some(current_executable_dir),
        Some(resources.clone()),
        resources.parent().map(Path::to_path_buf),
    ]
    .into_iter()
    .flatten()
    {
        for name in sidecar_names {
            sidecar_candidates.push(directory.join(name));
        }
    }
    let installed_sidecar = sidecar_candidates
        .iter()
        .find(|path| path.is_file())
        .cloned();
    if let Some(installed_sidecar) = installed_sidecar {
        eprintln!(
            "[INFO] Generador empaquetado localizado: {}",
            installed_sidecar.display()
        );
        return Ok(GeneratorResources {
            template_dir: resources.join("ebook-template"),
            sound: resources.join("ebook-assets/page-turn.mp3"),
            fonts_dir: resources.join("ebook-fonts"),
            script_or_binary: installed_sidecar,
            use_python: false,
        });
    }

    eprintln!(
        "[ERROR] Generador empaquetado no encontrado. Rutas comprobadas: {sidecar_candidates:?}"
    );
    Err("No se encontró el componente de generación. Reinstala CLA Ebooks Creator con el instalador más reciente.".into())
}

fn quality_values(quality: &str) -> Result<(u32, u8), String> {
    match quality {
        "normal" => Ok((1400, 82)),
        "high" => Ok((1800, 88)),
        "maximum" => Ok((2200, 94)),
        _ => Err("La calidad seleccionada no es válida".into()),
    }
}

fn selected_background(path: Option<&str>) -> Result<Option<PathBuf>, String> {
    let Some(path) = path.filter(|path| !path.trim().is_empty()) else {
        return Ok(None);
    };
    let image = PathBuf::from(path);
    let extension = image
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    if !image.is_file() || !matches!(extension.as_deref(), Some("jpg" | "jpeg" | "png" | "webp")) {
        return Err("Selecciona una imagen de fondo válida (JPG, PNG o WebP).".into());
    }
    Ok(Some(image))
}

fn start_generator(resources: &GeneratorResources) -> Result<Command, String> {
    let mut command = if resources.use_python {
        let mut command = Command::new("py");
        command.arg("-3").arg(&resources.script_or_binary);
        command
    } else if resources.script_or_binary.is_file() {
        Command::new(&resources.script_or_binary)
    } else {
        return Err(
            "No se encontró el componente de generación. Reinstala CLA Ebooks Creator.".into(),
        );
    };
    hide_generator_console(&mut command);
    Ok(command)
}

#[cfg(windows)]
fn hide_generator_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    // Conserva stdout/stderr para el progreso, sin crear una ventana de consola visible.
    command.creation_flags(0x0800_0000);
}

#[cfg(not(windows))]
fn hide_generator_console(_command: &mut Command) {}

fn friendly_error(error: impl AsRef<str>) -> String {
    let raw = error.as_ref();
    let lower = raw.to_lowercase();
    if lower.contains("password") || lower.contains("encrypted") || lower.contains("needs_pass") {
        "El PDF está protegido con contraseña. Desbloquéalo antes de generar el ebook.".into()
    } else if lower.contains("ya existe") {
        raw.into()
    } else if lower.contains("permission") || lower.contains("access is denied") {
        "No hay permisos para leer o guardar en esa ubicación. Elige otra carpeta.".into()
    } else if lower.contains("space") || lower.contains("disk full") {
        "No hay espacio suficiente para crear el ebook.".into()
    } else if lower.contains("cannot open")
        || lower.contains("failed to open")
        || lower.contains("no se pudo")
    {
        "No se pudo abrir el PDF. Comprueba que no esté corrupto e inténtalo de nuevo.".into()
    } else {
        "No se pudo generar el ebook. Comprueba el PDF y la carpeta de destino.".into()
    }
}

fn execute_generator(
    app: AppHandle,
    resources: GeneratorResources,
    arguments: Vec<String>,
) -> Result<String, String> {
    let mut command = start_generator(&resources)?;
    let mut child = command
        .args(arguments)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            if resources.use_python && error.kind() == std::io::ErrorKind::NotFound {
                "No se encontró el generador de desarrollo. Instala Python y sus dependencias para desarrollar la aplicación.".into()
            } else {
                friendly_error(error.to_string())
            }
        })?;
    let stdout = child
        .stdout
        .take()
        .ok_or("No se pudo recibir el progreso del generador")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("No se pudo recibir los errores del generador")?;
    let stderr_reader = std::thread::spawn(move || {
        let mut text = String::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            text.push_str(&line);
            text.push('\n');
        }
        text
    });
    let mut result = None;
    let mut reported_error = None;
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        if let Some(value) = line.strip_prefix("PROGRESS|") {
            if let Some((percent, message)) = value.split_once('|') {
                if let Ok(percent) = percent.parse::<u8>() {
                    eprintln!("[INFO] {message}");
                    let _ = app.emit(
                        "generation-progress",
                        GenerationProgress {
                            percent,
                            message: message.to_string(),
                        },
                    );
                }
            }
        } else if let Some(value) = line.strip_prefix("RESULT|") {
            result = Some(value.to_string());
        } else if let Some(value) = line.strip_prefix("ERROR|") {
            reported_error = Some(value.to_string());
        } else if line.starts_with('{') {
            // El modo de inspección devuelve directamente el JSON con las páginas.
            result = Some(line);
        }
    }
    let status = child
        .wait()
        .map_err(|error| friendly_error(error.to_string()))?;
    let stderr_text = stderr_reader.join().unwrap_or_default();
    if !status.success() {
        return Err(friendly_error(reported_error.unwrap_or(stderr_text)));
    }
    result.ok_or_else(|| friendly_error("El generador terminó sin resultado"))
}

#[tauri::command]
async fn inspect_pdf(app: AppHandle, pdf_path: String) -> Result<PdfInfo, String> {
    let path = Path::new(&pdf_path);
    if !path.is_file()
        || path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("pdf"))
            != Some(true)
    {
        return Err("Selecciona un archivo PDF válido.".into());
    }
    let resources = generator_resources(&app)?;
    let response = tauri::async_runtime::spawn_blocking(move || {
        execute_generator(
            app,
            resources,
            vec!["--inspect".into(), "--pdf".into(), pdf_path],
        )
    })
    .await
    .map_err(|_| "No se pudo analizar el PDF.".to_string())??;
    serde_json::from_str(&response).map_err(|_| "No se pudo leer la información del PDF.".into())
}

#[tauri::command]
async fn generate_ebook(
    app: AppHandle,
    request: GenerationRequest,
) -> Result<GenerationResult, String> {
    if request.title.trim().is_empty() {
        return Err("Escribe un título para el ebook.".into());
    }
    let (long_edge, quality) = quality_values(&request.quality)?;
    let output = PathBuf::from(&request.output_path);
    if output.as_os_str().is_empty() {
        return Err("Elige una carpeta para guardar el ebook.".into());
    }
    let resources = generator_resources(&app)?;
    let background = selected_background(request.background_path.as_deref())?;
    let mut arguments = vec![
        "--pdf".into(),
        request.pdf_path,
        "--output".into(),
        request.output_path,
        "--title".into(),
        request.title,
        "--long-edge".into(),
        long_edge.to_string(),
        "--quality".into(),
        quality.to_string(),
        "--sound-enabled".into(),
        request.sound_enabled.to_string(),
        "--template-dir".into(),
        resources.template_dir.to_string_lossy().into_owned(),
        "--sound-file".into(),
        resources.sound.to_string_lossy().into_owned(),
        "--fonts-dir".into(),
        resources.fonts_dir.to_string_lossy().into_owned(),
    ];
    if let Some(background) = background {
        arguments.extend([
            "--background".into(),
            background.to_string_lossy().into_owned(),
        ]);
    }
    let response =
        tauri::async_runtime::spawn_blocking(move || execute_generator(app, resources, arguments))
            .await
            .map_err(|_| "La generación se interrumpió inesperadamente.".to_string())??;
    serde_json::from_str::<SidecarResult>(&response)
        .map(|result| GenerationResult {
            output_path: result.output_path,
            zip_path: result.zip_path,
            page_count: result.page_count,
            size_bytes: result.size_bytes,
            name: result.name,
        })
        .map_err(|_| "No se pudo leer el resultado de la generación.".into())
}

#[tauri::command]
fn suggested_output_dir(app: AppHandle, title: String) -> Result<String, String> {
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| format!("No se pudo acceder a Descargas: {error}"))?;
    let safe = title
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    Ok(downloads
        .join("CLA Ebooks Creator")
        .join(if safe.is_empty() { "ebook" } else { &safe })
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
fn preview_output_dir(app: AppHandle, title: String) -> Result<String, String> {
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("No se pudo preparar la vista previa: {error}"))?;
    let safe = title
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    Ok(cache
        .join("previews")
        .join(format!(
            "{}-{}",
            safe.trim_matches('-'),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ))
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
fn path_size(path: String) -> Result<u64, String> {
    fn walk(path: &Path) -> std::io::Result<u64> {
        if path.is_file() {
            return Ok(path.metadata()?.len());
        }
        fs::read_dir(path)?.try_fold(0, |size, entry| Ok(size + walk(&entry?.path())?))
    }
    walk(Path::new(&path)).map_err(|error| friendly_error(error.to_string()))
}

#[tauri::command]
fn export_zip(zip_path: String, destination_path: String) -> Result<(), String> {
    let source = Path::new(&zip_path);
    let destination = Path::new(&destination_path);
    if !source.is_file() {
        return Err("No se encontró el archivo ZIP generado.".into());
    }
    if source == destination {
        return Ok(());
    }
    fs::copy(source, destination)
        .map(|_| ())
        .map_err(|error| friendly_error(error.to_string()))
}

#[tauri::command]
fn serve_preview(output_path: String) -> Result<String, String> {
    let directory = PathBuf::from(output_path);
    if !directory.join("index.html").is_file() {
        return Err("No se encontró el ebook preparado para la vista previa.".into());
    }
    let server = preview_server()?;
    let token = format!(
        "ebook-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    server
        .directories
        .lock()
        .map_err(|_| "No se pudo preparar la vista previa.".to_string())?
        .insert(token.clone(), directory);
    Ok(format!(
        "http://127.0.0.1:{}/{token}/index.html?embed=1",
        server.port
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_pdf,
            generate_ebook,
            suggested_output_dir,
            preview_output_dir,
            path_size,
            export_zip,
            serve_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running CLA Ebooks Creator");
}

#[cfg(test)]
mod tests {
    use super::{preview_content_type, quality_values};
    use std::path::Path;

    #[test]
    fn maps_quality_profiles() {
        assert_eq!(quality_values("high"), Ok((1800, 88)));
        assert!(quality_values("unknown").is_err());
    }

    #[test]
    fn serves_known_preview_content_types() {
        assert_eq!(
            preview_content_type(Path::new("book/index.html")),
            "text/html; charset=utf-8"
        );
        assert_eq!(
            preview_content_type(Path::new("book/page.webp")),
            "image/webp"
        );
        assert_eq!(
            preview_content_type(Path::new("book/unknown")),
            "application/octet-stream"
        );
    }
}
