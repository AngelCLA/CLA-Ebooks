import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PdfDropzone } from "./components/PdfDropzone";
import { EbookSettings } from "./components/EbookSettings";
import { EbookPreview } from "./components/EbookPreview";
import { GenerationProgress } from "./components/GenerationProgress";
import { GenerationResult } from "./components/GenerationResult";
import { useGenerationProgress } from "./hooks/useGenerationProgress";
import type {
  BackgroundImage,
  EbookResult,
  PdfFile,
  Quality,
} from "./types/ebook";
import { formatBytes, suggestTitle } from "./services/ebook";
import "./App.css";

function App() {
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "system",
  );
  const [systemDarkMode, setSystemDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const darkMode =
    themeMode === "system" ? systemDarkMode : themeMode === "dark";
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [title, setTitle] = useState("");
  const [quality, setQuality] = useState<Quality>("high");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [background, setBackground] = useState<BackgroundImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [result, setResult] = useState<EbookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useGenerationProgress();

  useEffect(() => {
    if (pdf) setTitle((current) => current || suggestTitle(pdf.name));
  }, [pdf]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setSystemDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncTheme);
    return () => mediaQuery.removeEventListener("change", syncTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop" && event.payload.paths[0])
          void loadPdf(event.payload.paths[0]);
      })
      .then((stop) => {
        unlisten = stop;
      });
    return () => unlisten?.();
  }, []);

  async function selectPdf() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (typeof selected === "string") await loadPdf(selected);
  }

  async function selectBackground() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        { name: "Imágenes", extensions: ["jpg", "jpeg", "png", "webp"] },
      ],
    });
    if (typeof selected === "string") {
      setBackground({
        path: selected,
        name: selected.split(/[\\/]/).pop() ?? "Imagen de fondo",
      });
      setPreviewUrl(null);
      setResult(null);
    }
  }

  async function loadPdf(path: string) {
    if (!path.toLowerCase().endsWith(".pdf")) {
      setError("Selecciona un archivo PDF.");
      return;
    }
    setError(null);
    setResult(null);
    setPreviewUrl(null);
    try {
      const info = await invoke<{ pageCount: number }>("inspect_pdf", {
        pdfPath: path,
      });
      const name = path.split(/[\\/]/).pop() ?? "Documento.pdf";
      const sizeBytes = await invoke<number>("path_size", { path });
      setPdf({ path, name, sizeBytes, pageCount: info.pageCount });
      setTitle(suggestTitle(name));
    } catch (reason) {
      setPdf(null);
      setError(
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : "No se pudo abrir el PDF.",
      );
    }
  }

  async function createPreview() {
    if (!pdf) return;
    setPreviewBusy(true);
    setError(null);
    try {
      const outputPath = await invoke<string>("preview_output_dir", {
        title: `${title || suggestTitle(pdf.name)}-vista-previa`,
      });
      const generated = await invoke<EbookResult>("generate_ebook", {
        request: {
          pdfPath: pdf.path,
          title: title.trim() || suggestTitle(pdf.name),
          quality,
          soundEnabled,
          backgroundPath: background?.path,
          outputPath,
        },
      });
      setPreviewUrl(
        await invoke<string>("serve_preview", {
          outputPath: generated.outputPath,
        }),
      );
    } catch (reason) {
      setError(
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : "No se pudo preparar la vista previa.",
      );
    } finally {
      setPreviewBusy(false);
    }
  }

  async function generate() {
    if (!pdf) return;
    setError(null);
    const defaultPath = await invoke<string>("suggested_output_dir", {
      title: title.trim() || suggestTitle(pdf.name),
    });
    const parent = await open({
      directory: true,
      multiple: false,
      title: "Elige dónde guardar el ebook",
    });
    if (parent === null) return;
    const safeName = defaultPath.split(/[\\/]/).pop() ?? "ebook";
    const separator = parent.endsWith("\\") || parent.endsWith("/") ? "" : "/";
    try {
      const generated = await invoke<EbookResult>("generate_ebook", {
        request: {
          pdfPath: pdf.path,
          title: title.trim() || suggestTitle(pdf.name),
          quality,
          soundEnabled,
          backgroundPath: background?.path,
          outputPath: `${parent}${separator}${safeName}`,
        },
      });
      setResult(generated);
      setPreviewUrl(
        await invoke<string>("serve_preview", {
          outputPath: generated.outputPath,
        }),
      );
    } catch (reason) {
      setError(
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : "No se pudo generar el ebook.",
      );
    }
  }

  async function exportZip() {
    if (!result) return;
    const target = await save({
      defaultPath: `${result.name}.zip`,
      filters: [{ name: "Archivo ZIP", extensions: ["zip"] }],
    });
    if (typeof target === "string")
      await invoke("export_zip", {
        zipPath: result.zipPath,
        destinationPath: target,
      });
  }

  async function openResult(action: () => Promise<void>) {
    try {
      await action();
    } catch (reason) {
      setError(
        typeof reason === "string" ? reason : "No se pudo abrir esa ubicación.",
      );
    }
  }

  const generating = progress.active || previewBusy;
  const nextThemeMode =
    themeMode === "system" ? "dark" : themeMode === "dark" ? "light" : "system";
  const themeLabel =
    themeMode === "system"
      ? "Sistema"
      : themeMode === "dark"
        ? "Oscuro"
        : "Claro";

  return (
    <main className={`creator-shell ${darkMode ? "dark-theme" : ""}`}>
      <header className="creator-header">
        <img
          className="brand-mark"
          src={darkMode ? "/logo-dark.svg" : "/logo.svg"}
          alt="CLA Ebooks Creator"
        />
        <div>
          <strong>CLA Ebooks Creator</strong>
          <span>PDF a ebook interactivo</span>
        </div>
        <button
          className="theme-toggle"
          type="button"
          title={`Tema: ${themeLabel}. Cambiar a ${nextThemeMode === "system" ? "sistema" : `modo ${nextThemeMode}`}`}
          aria-label={`Tema: ${themeLabel}. Cambiar a ${nextThemeMode === "system" ? "sistema" : `modo ${nextThemeMode}`}`}
          onClick={() => setThemeMode(nextThemeMode)}
        >
          {themeMode === "system" ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          ) : darkMode ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.7 15.2A8.8 8.8 0 0 1 8.8 3.3 8.8 8.8 0 1 0 20.7 15.2Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </button>
      </header>

      <div className="workspace">
        <div className="editor-column">
          <section className="hero">
            <span className="eyebrow">CREA Y PUBLICA</span>
            <h1>Convierte tu PDF en una experiencia de lectura.</h1>
            <p>
              Un ebook listo para compartir, publicar o insertar en tu
              plataforma institucional.
            </p>
          </section>

          <section className="setup-card" aria-label="Configuración del ebook">
            <PdfDropzone
              pdf={pdf}
              onSelect={selectPdf}
              onClear={() => {
                setPdf(null);
                setPreviewUrl(null);
                setResult(null);
                setTitle("");
              }}
            />
            {pdf && (
              <EbookSettings
                title={title}
                quality={quality}
                soundEnabled={soundEnabled}
                background={background}
                onTitleChange={setTitle}
                onQualityChange={setQuality}
                onSoundChange={setSoundEnabled}
                onBackgroundSelect={selectBackground}
                onBackgroundClear={() => {
                  setBackground(null);
                  setPreviewUrl(null);
                  setResult(null);
                }}
              />
            )}
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            {pdf && (
              <div className="actions">
                <button
                  className="secondary-button"
                  onClick={createPreview}
                  disabled={generating}
                >
                  {previewBusy ? "Preparando vista previa..." : "Vista previa"}
                </button>
                <button
                  className="primary-button"
                  onClick={generate}
                  disabled={generating}
                >
                  Generar Ebook
                </button>
              </div>
            )}
          </section>
        </div>

        <section className="preview-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">RESULTADO</span>
              <h2>Vista previa</h2>
            </div>
            {pdf && (
              <span className="file-summary">
                {pdf.pageCount} páginas · {formatBytes(pdf.sizeBytes)}
              </span>
            )}
          </div>
          <EbookPreview
            url={previewUrl}
            onCreate={createPreview}
            busy={previewBusy}
            hasPdf={Boolean(pdf)}
          />
        </section>
      </div>

      {progress.active && (
        <GenerationProgress
          percent={progress.percent}
          message={progress.message}
        />
      )}
      {result && (
        <GenerationResult
          result={result}
          onClose={() => setResult(null)}
          onOpenBook={() =>
            openResult(() => openPath(`${result.outputPath}/index.html`))
          }
          onOpenFolder={() => openResult(() => openPath(result.outputPath))}
          onOpenZip={() => openResult(exportZip)}
        />
      )}
    </main>
  );
}

export default App;
