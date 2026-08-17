import type { EbookResult } from "../types/ebook";
import { formatBytes } from "../services/ebook";
interface Props {
  result: EbookResult;
  onClose: () => void;
  onOpenBook: () => void;
  onOpenFolder: () => void;
  onOpenZip: () => void;
}
export function GenerationResult({
  result,
  onClose,
  onOpenBook,
  onOpenFolder,
  onOpenZip,
}: Props) {
  return (
    <div className="modal-backdrop">
      <div className="result-modal">
        <button className="close-modal" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
        <div className="success-mark">✓</div>
        <span className="eyebrow">LISTO PARA COMPARTIR</span>
        <h2>Ebook generado correctamente</h2>
        <p>
          <strong>{result.name}</strong>
          <br />
          {result.pageCount} páginas · ZIP de {formatBytes(result.sizeBytes)}
        </p>
        <div className="result-actions">
          <button className="primary-button" onClick={onOpenBook}>
            Abrir Ebook
          </button>
          <button className="secondary-button" onClick={onOpenFolder}>
            Abrir carpeta
          </button>
          <button className="text-button" onClick={onOpenZip}>
            Guardar / Exportar ZIP
          </button>
        </div>
      </div>
    </div>
  );
}
