$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "src-tauri\sidecar\generator.py"
$dist = Join-Path $root "src-tauri\binaries"
$requirements = Join-Path $root "src-tauri\sidecar\requirements-build.txt"
$venv = Join-Path $root ".venv"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path -LiteralPath $source)) {
  throw "No se encontro el generador sidecar: $source"
}
if (-not (Test-Path -LiteralPath $requirements)) {
  throw "No se encontraron las dependencias del generador: $requirements"
}
if (-not (Test-Path -LiteralPath $python)) {
  py -3 -m venv $venv
}

& $python -m pip install --disable-pip-version-check --requirement $requirements
if ($LASTEXITCODE -ne 0) {
  throw "No se pudieron instalar las dependencias del generador."
}
& $python -m PyInstaller --noconfirm --clean --onefile --name ebook-generator $source
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo empaquetar el generador."
}
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Copy-Item -LiteralPath (Join-Path $root "dist\ebook-generator.exe") -Destination (Join-Path $dist "ebook-generator-x86_64-pc-windows-msvc.exe") -Force
