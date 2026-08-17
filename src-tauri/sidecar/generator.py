#!/usr/bin/env python3
"""Sidecar empaquetable del motor aprobado de PDF a ebook."""

from __future__ import annotations

import argparse
import html
import json
import shutil
import sys
import zipfile
from pathlib import Path

try:
    import fitz
    from PIL import Image
except ImportError as exc:
    raise SystemExit("No se pudieron cargar los componentes de conversión") from exc

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def report(percent: int, message: str) -> None:
    print(f"PROGRESS|{percent}|{message}", flush=True)


def safe_name(value: str) -> str:
    cleaned = "".join(c if c.isalnum() or c in "-_" else "-" for c in value.strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "ebook"


def ensure_new_destination(output_dir: Path) -> Path:
    zip_path = output_dir.with_suffix(".zip")
    if output_dir.exists():
        raise FileExistsError("La carpeta de destino ya existe. Elige otra ubicación.")
    if zip_path.exists():
        raise FileExistsError("El archivo ZIP de destino ya existe. Elige otra ubicación.")
    return zip_path


def inspect_pdf(pdf_path: Path) -> None:
    document = fitz.open(pdf_path)
    try:
        if document.page_count == 0:
            raise ValueError("El PDF no contiene páginas")
        print(json.dumps({"pageCount": document.page_count}), flush=True)
    finally:
        document.close()


def render_pdf(pdf_path: Path, pages_dir: Path, long_edge: int, quality: int) -> tuple[list[dict], float]:
    document = fitz.open(pdf_path)
    if document.page_count == 0:
        document.close()
        raise ValueError("El PDF no contiene páginas")

    pages: list[dict] = []
    ratios: list[float] = []
    pages_dir.mkdir(parents=True, exist_ok=True)
    total = document.page_count
    try:
        for index in range(total):
            page = document.load_page(index)
            rect = page.rect
            ratios.append(rect.width / rect.height)
            scale = long_edge / max(rect.width, rect.height)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csRGB)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            filename = f"page-{index + 1:04d}.webp"
            image.save(pages_dir / filename, "WEBP", quality=quality, method=6, optimize=True)
            pages.append(
                {"number": index + 1, "src": f"pages/{filename}", "width": pixmap.width, "height": pixmap.height}
            )
            report(6 + round((index + 1) / total * 84), f"Convirtiendo página {index + 1} de {total}")
    finally:
        document.close()
    return pages, sum(ratios) / len(ratios)


READER_THEME = """@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;src:url('./ibm-plex-mono-latin-ext-400-normal.woff2') format('woff2')}@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:600;src:url('./ibm-plex-mono-latin-ext-600-normal.woff2') format('woff2')}@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:700;src:url('./ibm-plex-mono-latin-ext-700-normal.woff2') format('woff2')}:root{--bg:#161016;--panel:rgba(8,8,9,.87);--panel-strong:rgba(4,4,5,.95);--panel-border:rgba(255,255,255,.12);--ui-shadow:0 12px 32px rgba(0,0,0,.42),0 2px 8px rgba(0,0,0,.3)}html,body{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Consolas,monospace}body{background:#161016}.app{background-color:#161016}.app::before{background:rgba(0,0,0,.66)}.app::after{background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.035),transparent 42%),linear-gradient(to bottom,rgba(0,0,0,.03),rgba(0,0,0,.13))}.glass-panel,.floating-square{background:var(--panel);border-color:var(--panel-border)}.nav-icon-btn,.tool-btn,.floating-square{color:rgba(255,255,255,.84)}.nav-icon-btn:hover,.tool-btn:hover,.floating-square:hover{background:rgba(255,255,255,.12);color:#fff}.keyboard-university,.keyboard-department a{color:#f38bc8}.keyboard-university:hover,.keyboard-department a:hover{color:#ffc1e6}.keyboard-separator,.tool-divider{background:rgba(255,255,255,.12)}.loading{background:rgba(0,0,0,.77)}.loading-book i{background:rgba(255,255,255,.94)}"""


def build_ebook(args: argparse.Namespace) -> dict:
    pdf_path = Path(args.pdf).resolve()
    output_dir = Path(args.output).resolve()
    template_dir = Path(args.template_dir).resolve()
    background = Path(args.background).resolve() if args.background else None
    sound = Path(args.sound_file).resolve()
    fonts_dir = Path(args.fonts_dir).resolve()
    if not pdf_path.is_file() or pdf_path.suffix.lower() != ".pdf":
        raise ValueError("Selecciona un archivo PDF válido")
    if not template_dir.is_dir():
        raise FileNotFoundError("No se encontró la plantilla del lector")
    zip_path = ensure_new_destination(output_dir)
    output_dir.mkdir(parents=True)

    report(2, "Preparando el ebook")
    pages, ratio = render_pdf(pdf_path, output_dir / "pages", args.long_edge, args.quality)
    report(91, "Copiando el lector interactivo")
    assets = output_dir / "assets"
    assets.mkdir()
    shutil.copy2(template_dir / "reader.css", assets / "reader.css")
    shutil.copy2(template_dir / "reader.js", assets / "reader.js")
    theme = READER_THEME
    for weight in (400, 600, 700):
        font_name = f"ibm-plex-mono-latin-ext-{weight}-normal.woff2"
        font = fonts_dir / font_name
        if font.is_file():
            shutil.copy2(font, assets / font_name)
    if background and background.is_file():
        # El lector siempre carga el mismo recurso WebP, aunque el usuario elija JPG o PNG.
        with Image.open(background) as image:
            image.convert("RGB").save(assets / "MMixta.webp", "WEBP", quality=90, method=6)
        theme += ".app{background-image:url('./MMixta.webp')}"
    (assets / "reader-theme.css").write_text(theme, encoding="utf-8")
    if sound.is_file():
        shutil.copy2(sound, assets / "page-turn.mp3")

    config = {
        "title": args.title,
        "pageCount": len(pages),
        "averagePageRatio": round(ratio, 5),
        "pages": pages,
        "settings": {
            "turnDuration": 720,
            "preloadRadius": 3,
            "sound": args.sound_enabled == "true",
            "showCoverSingle": True,
        },
    }
    report(94, "Preparando la portada y navegación")
    template = (template_dir / "index.html").read_text(encoding="utf-8")
    template = template.replace(
        '<link rel="stylesheet" href="assets/reader.css">',
        '<link rel="stylesheet" href="assets/reader.css">\n  <link rel="stylesheet" href="assets/reader-theme.css">',
    )
    book_html = template.replace("__BOOK_TITLE__", html.escape(args.title))
    (output_dir / "index.html").write_text(book_html, encoding="utf-8")
    # La configuracion se escribe en un recurso JavaScript, no dentro del HTML,
    # para que un titulo con </script> no pueda cerrar un bloque de script.
    (assets / "book-config.js").write_text(
        f"window.BOOK_CONFIG={json.dumps(config, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    readme = f"""# {args.title}\n\nEbook HTML generado desde `{pdf_path.name}`.\n\n- Abre `index.html` para leerlo offline.\n- Puedes subir esta carpeta a cualquier servidor estático.\n- No requiere conexión a internet, CDN ni backend.\n- Puede insertarse directamente con un iframe usando `index.html?embed=1`.\n"""
    (output_dir / "LEEME.md").write_text(readme, encoding="utf-8")

    report(96, "Creando el archivo ZIP")
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in output_dir.rglob("*"):
            if file.is_file():
                archive.write(file, file.relative_to(output_dir.parent))
    report(100, "Ebook generado correctamente")
    return {
        "outputPath": str(output_dir),
        "zipPath": str(zip_path),
        "pageCount": len(pages),
        "sizeBytes": zip_path.stat().st_size,
        "name": args.title,
        "safeName": safe_name(args.title),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--output")
    parser.add_argument("--title")
    parser.add_argument("--long-edge", type=int)
    parser.add_argument("--quality", type=int)
    parser.add_argument("--sound-enabled", choices=["true", "false"])
    parser.add_argument("--template-dir")
    parser.add_argument("--background")
    parser.add_argument("--sound-file")
    parser.add_argument("--fonts-dir")
    args = parser.parse_args()
    try:
        if args.inspect:
            inspect_pdf(Path(args.pdf))
            return 0
        required = [
            args.output,
            args.title,
            args.long_edge,
            args.quality,
            args.sound_enabled,
            args.template_dir,
            args.sound_file,
            args.fonts_dir,
        ]
        if any(value is None for value in required):
            raise ValueError("Faltan parámetros para generar el ebook")
        result = build_ebook(args)
        print(f"RESULT|{json.dumps(result, ensure_ascii=False)}", flush=True)
        return 0
    except Exception as error:
        print(f"ERROR|{error}", flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
