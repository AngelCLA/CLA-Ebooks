interface Props {
  url: string | null;
  onCreate: () => void;
  busy: boolean;
  hasPdf: boolean;
}
export function EbookPreview({ url, onCreate, busy, hasPdf }: Props) {
  if (url)
    return (
      <div className="preview-frame">
        <iframe src={url} title="Vista previa del ebook" allow="fullscreen" />
      </div>
    );
  return (
    <div className="preview-empty">
      <div className="book-placeholder" aria-hidden="true">
        <i />
        <i />
      </div>
      <strong>
        {hasPdf ? "Prepara una vista previa" : "Tu ebook aparecerá aquí"}
      </strong>
      <span>
        {hasPdf
          ? "Comprueba el lector real antes de exportar."
          : "Selecciona un PDF para empezar."}
      </span>
      {hasPdf && (
        <button className="preview-button" disabled={busy} onClick={onCreate}>
          {busy ? "Preparando..." : "Crear vista previa"}
        </button>
      )}
    </div>
  );
}
