import type { BackgroundImage, Quality } from "../types/ebook";

interface Props {
  title: string;
  quality: Quality;
  soundEnabled: boolean;
  background: BackgroundImage | null;
  onTitleChange: (value: string) => void;
  onQualityChange: (value: Quality) => void;
  onSoundChange: (value: boolean) => void;
  onBackgroundSelect: () => void;
  onBackgroundClear: () => void;
}
const options: { value: Quality; name: string; description: string }[] = [
  { value: "normal", name: "Normal", description: "Prioriza tamaño" },
  { value: "high", name: "Alta", description: "Recomendada" },
  { value: "maximum", name: "Máxima", description: "Prioriza resolución" },
];

export function EbookSettings({
  title,
  quality,
  soundEnabled,
  background,
  onTitleChange,
  onQualityChange,
  onSoundChange,
  onBackgroundSelect,
  onBackgroundClear,
}: Props) {
  return (
    <div className="settings">
      <label className="field-label">
        Título del ebook
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Título del ebook"
        />
      </label>
      <fieldset>
        <legend>Calidad</legend>
        <div className="quality-options">
          {options.map((option) => (
            <button
              key={option.value}
              className={`quality-option ${quality === option.value ? "selected" : ""}`}
              onClick={() => onQualityChange(option.value)}
            >
              <strong>{option.name}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="background-option">
        <div>
          <strong>Imagen de fondo</strong>
          <small>
            {background ? background.name : "Usa el fondo predeterminado"}
          </small>
        </div>
        <div className="background-actions">
          <button
            type="button"
            className="text-button"
            onClick={onBackgroundSelect}
          >
            {background ? "Cambiar" : "Elegir imagen"}
          </button>
          {background && (
            <button
              type="button"
              className="icon-button danger"
              aria-label="Usar fondo predeterminado"
              title="Usar fondo predeterminado"
              onClick={onBackgroundClear}
            >
              ×
            </button>
          )}
        </div>
      </div>
      <label className="sound-option">
        <span>
          <strong>Sonido al pasar página</strong>
          <small>Incluye el efecto de cambio de página</small>
        </span>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(event) => onSoundChange(event.target.checked)}
        />
        <i aria-hidden="true" />
      </label>
    </div>
  );
}
