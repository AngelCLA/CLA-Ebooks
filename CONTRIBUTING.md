# Contribuir a CLA Ebooks Creator

Gracias por contribuir. Este proyecto convierte PDFs en ebooks HTML para uso local y publicación estática.

## Requisitos

- Bun 1.3.14
- Rust 1.97.1 con la herramienta MSVC de Windows
- Python 3.14 con el comando `py`

## Preparar el entorno

```powershell
bun install --frozen-lockfile
py -m pip install -r requirements-dev.txt
```

## Comandos de desarrollo

```powershell
# Interfaz web
bun run dev

# Aplicacion de escritorio
bun run tauri dev

# Validar tipos y generar el frontend
bun run typecheck
bun run build

# Empaquetar el generador Python para Windows
bun run build:sidecar

# Crear el instalador
bun run tauri:build
```

## Proceso de contribucion

1. Abre una issue para cambios de comportamiento, funciones grandes o cambios visuales relevantes.
2. Crea una rama con un nombre descriptivo.
3. Mantiene el cambio acotado y actualiza la documentacion cuando modifique el uso, los requisitos o el proceso de build.
4. Ejecuta `bun run check` y `bun run build` antes de abrir un pull request.
5. Describe que cambio, como se verifico y cualquier limitacion pendiente.

## Criterios de codigo

- Conserva TypeScript estricto y evita `any` cuando exista un tipo real.
- No incluyas `node_modules`, `dist`, `src-tauri/target`, binarios del sidecar ni ebooks exportados.
- Mantiene los recursos editables en `resources/`; los artefactos generados no se versionan.
- Trata las rutas elegidas por la persona usuaria como datos no confiables y no borres archivos fuera de la salida controlada por la aplicacion.
- No incluyas secretos, rutas locales ni datos personales en commits, issues o pull requests.

## Reportes de seguridad

No abras issues publicas para vulnerabilidades. Consulta [SECURITY.md](SECURITY.md) para el canal de reporte responsable.
