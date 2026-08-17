interface Props {
  percent: number;
  message: string;
}
export function GenerationProgress({ percent, message }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="progress-modal">
        <div className="spinner" />
        <span className="eyebrow">PROCESANDO</span>
        <h2>Generando Ebook</h2>
        <div className="progress-track">
          <i style={{ width: `${percent}%` }} />
        </div>
        <strong>{percent}%</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
