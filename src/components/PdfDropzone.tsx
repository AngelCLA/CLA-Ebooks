import { useState } from "react";
import type { PdfFile } from "../types/ebook";
import { formatBytes } from "../services/ebook";

interface Props {
  pdf: PdfFile | null;
  onSelect: () => void;
  onClear: () => void;
}

export function PdfDropzone({ pdf, onSelect, onClear }: Props) {
  const [dragging, setDragging] = useState(false);
  if (pdf)
    return (
      <div className="pdf-selected">
        <div className="pdf-icon">PDF</div>
        <div className="pdf-details">
          <strong>{pdf.name}</strong>
          <span>
            {formatBytes(pdf.sizeBytes)} · {pdf.pageCount} páginas
          </span>
        </div>
        <button className="text-button" onClick={onSelect}>
          Cambiar
        </button>
        <button
          className="icon-button danger"
          aria-label="Eliminar PDF"
          onClick={onClear}
        >
          ×
        </button>
      </div>
    );
  return (
    <div
      className={`dropzone ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
    >
      <div className="upload-symbol" aria-hidden="true">
        ↓
      </div>
      <strong>Arrastra tu PDF aquí</strong>
      <span>o elige un archivo desde tu equipo</span>
      <button className="select-button" onClick={onSelect}>
        Seleccionar PDF
      </button>
    </div>
  );
}
