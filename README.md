# CLA Ebooks Creator

**Convierte PDFs en experiencias de lectura que se pueden abrir, compartir y publicar sin depender de una plataforma externa.**

CLA Ebooks Creator es una aplicación de escritorio para transformar un PDF en un ebook HTML interactivo. El resultado conserva la lectura por páginas, añade navegación, zoom, pantalla completa y un paquete ZIP listo para distribuir o alojar en cualquier servidor estático.

No pretende ser otro conversor de documentos. Surge para evitar que materiales valiosos terminen como adjuntos pesados, visores con publicidad, enlaces que caducan o publicaciones que exigen cuentas, conocimientos técnicos y pagos para abrirse o publicarse.

## Por Qué Surge

Un PDF puede contener una guía, una memoria, un informe, una revista o material didáctico excelente, pero su distribución suele quedarse en un archivo descargable sin contexto de lectura. Compartirlo de forma más cuidada normalmente obliga a usar visores o generadores con costo, servicios de terceros, conversión manual por página o dependencia de un equipo técnico.

CLA Ebooks Creator nace para cubrir ese espacio: llevar un PDF a un lector autónomo, con identidad propia y una experiencia más cercana a hojear una publicación que a descargar un archivo. Es una herramienta totalmente gratuita para crear, revisar y exportar ebooks sin pagar por cada publicación.

## Propósito

Dar a docentes, áreas de comunicación, instituciones, autores y equipos editoriales una forma directa de publicar documentos interactivos sin sacrificar control sobre el contenido.

El ebook resultante pertenece a quien lo genera: puede mantenerse en una memoria USB, enviarse como ZIP, subirse a un sitio institucional o integrarse mediante un `iframe`. No requiere conexión, cuentas, CDN ni backend para funcionar.

## Objetivo

Reducir el proceso de publicación a una secuencia clara:

1. Seleccionar un PDF.
2. Personalizar título, calidad, sonido e imagen de fondo.
3. Revisar el lector antes de exportar.
4. Generar una carpeta y ZIP listos para compartir.

## Qué Resuelve

- **Publicación sin dependencia:** genera un lector HTML offline, no un enlace sujeto a una plataforma externa.
- **Distribución simple:** crea un ZIP para compartir y una carpeta lista para subir a hosting estático.
- **Carga técnica simplificada:** entrega una estructura preparada para que diseñadores y personal encargado de servidores publiquen el ebook sin conversiones adicionales, servicios de pago ni costos por carga.
- **Experiencia de lectura:** convierte páginas de PDF en un lector con navegación, giro de página, zoom y pantalla completa.
- **Identidad visual:** permite usar una imagen de fondo propia en el visor, o mantener el fondo oscuro predeterminado.
- **Revisión antes de publicar:** ofrece una vista previa del lector real antes de producir la entrega final.
- **Acceso técnico reducido:** el usuario final no necesita instalar Python, dependencias ni herramientas de conversión.
- **Control local:** los archivos se procesan en el equipo; el flujo no necesita enviar el PDF a un servicio web.

## Funciones

### Crear desde PDF

- Selección de archivos PDF desde el equipo.
- Arrastre de PDF a la ventana de la aplicación.
- Lectura de nombre, tamaño y número de páginas.
- Sugerencia automática de título a partir del nombre del documento.

### Configurar la publicación

- Título editable para el ebook.
- Tres niveles de calidad: **Normal** para priorizar tamaño de archivo, **Alta** como equilibrio recomendado y **Máxima** para priorizar resolución.
- Activación o desactivación del sonido al cambiar de página.
- Imagen de fondo opcional para el visor en formatos JPG, JPEG, PNG o WebP.
- Conversión automática de la imagen elegida a WebP para que el ebook permanezca autocontenido.
- Fondo oscuro limpio por defecto cuando no se selecciona una imagen.

### Revisar antes de exportar

- Vista previa integrada del ebook generado.
- El preview usa el mismo lector que recibirá la persona que abra el ebook final.
- Regeneración de la vista previa tras cambiar título, calidad, sonido o fondo.
- Progreso visible durante el análisis y la conversión de páginas.

### Entregar y compartir

- Carpeta de salida con `index.html`, páginas, recursos y archivo `LEEME.md`.
- Archivo ZIP generado automáticamente.
- Acciones para abrir el ebook, abrir la carpeta o guardar el ZIP en otra ubicación.
- Lector compatible con apertura local y servidores estáticos.
- Integración mediante `iframe` para sitios web.

### Experiencia del lector exportado

- Navegación por primera, anterior, siguiente y última página.
- Vista de doble página en escritorio y página individual en pantallas pequeñas.
- Controles táctiles, teclado y zonas de clic para avanzar o retroceder.
- Zoom, restablecimiento de zoom y pantalla completa.
- Sonido de paso de página opcional.
- Controles adaptados a móvil, iframe y pantallas de poca altura.
- Preferencia de reducción de movimiento respetada.
- Ayuda de teclado y atribución de CLA Ebooks | CLA Tech.

### Interfaz de creación

- Diseño responsive: dos columnas en escritorio y flujo vertical en tamaños reducidos.
- Modo claro, oscuro y automático según el sistema.
- Selector visual de tema con iconos de sistema, sol y luna.
- Iconografía y marca de CLA Ebooks Creator en aplicación, favicon e instalador.

## Para Quién Es

- Docentes que necesitan convertir materiales de clase en una lectura más accesible.
- Instituciones que desean compartir publicaciones sin entregar solo un PDF.
- Áreas de comunicación que publican informes, memorias, catálogos o revistas.
- Autores y equipos creativos que necesitan una entrega digital autocontenida.
- Diseñadores y personal técnico que cargan contenidos a servidores y necesitan un paquete listo para publicar, sin pasos extra ni costo.
- Personas que administran sitios web estáticos y quieren insertar un ebook sin depender de un visor ajeno.

## Resultado De Cada Generación

```text
Mi-Ebook/
  index.html        # Abre el lector
  assets/           # Estilos, scripts, fuentes y recursos
  pages/            # Páginas convertidas a WebP
  LEEME.md          # Instrucciones de publicación
Mi-Ebook.zip        # Paquete listo para compartir
```

## Requisitos Para Usar La Aplicación

La versión instalada está pensada para Windows. La persona usuaria solo necesita instalar CLA Ebooks Creator y seleccionar un PDF.

No necesita instalar Python, PyMuPDF, Pillow, Node.js ni herramientas de línea de comandos. El motor de conversión se distribuye empaquetado dentro de la aplicación y se ejecuta sin mostrar una ventana de terminal.

Windows 10 y 11 normalmente ya incluyen WebView2. Si falta en un equipo, Windows solicitará o requerirá ese componente para ejecutar aplicaciones basadas en WebView.

## Desarrollo

El proyecto usa React, TypeScript, Vite, Tauri y un sidecar de Python empaquetado para convertir los documentos.

Para desarrollar se necesita Bun 1.3.14, Rust 1.97.1 con las herramientas MSVC de Windows y Python 3.14. El archivo `rust-toolchain.toml` fija la version de Rust utilizada por el proyecto.

```bash
# Instalar dependencias
bun install --frozen-lockfile
py -m pip install -r requirements-dev.txt

# Ejecutar la interfaz web de desarrollo
bun run dev

# Ejecutar la aplicación de escritorio en desarrollo
bun run tauri dev

# Revisar tipos
bun run typecheck

# Formato, lint y pruebas
bun run format:check
bun run lint
bun run test
bun run check

# Construir el frontend
bun run build

# Generar el sidecar de conversión para Windows
bun run build:sidecar

# Crear el instalador final
bun run tauri:build
```

Para desarrollo del motor se requiere Python y las dependencias definidas en `src-tauri/sidecar/requirements-build.txt`. `bun run build:sidecar` crea y utiliza un entorno virtual local en `.venv`, instala las versiones fijadas y empaqueta el generador. Esa dependencia es exclusiva del entorno de desarrollo; no aplica a quienes instalan la aplicación final.

Las comprobaciones se ejecutan automaticamente en cada push y pull request mediante GitHub Actions.

## Tecnología

- [React](https://react.dev/) y TypeScript para la interfaz.
- [Vite](https://vite.dev/) para desarrollo y build del frontend.
- [Tauri](https://tauri.app/) para la aplicación de escritorio y empaquetado Windows.
- PyMuPDF y Pillow, incluidos en el sidecar de conversión, para analizar y renderizar PDFs.
- HTML, CSS y JavaScript estáticos para el lector entregado.

## Licencia

Este proyecto se distribuye bajo la [licencia MIT](LICENSE).

---

**CLA Ebooks Creator**
Una herramienta de [CLA Tech](https://github.com/AngelCLA) para que un PDF no sea el final de una publicación, sino el punto de partida de una experiencia de lectura.

[LICENSE]
