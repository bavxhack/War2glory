import { buildingArtFrame } from "../building-art.js";
import sawmillLevels from "../assets/building-levels/sawmill.webp";
import quarryLevels from "../assets/building-levels/quarry.webp";
import farmLevels from "../assets/building-levels/farm.webp";
import warehouseLevels from "../assets/building-levels/warehouse.webp";
import universityLevels from "../assets/building-levels/university.webp";
import refineryLevels from "../assets/building-levels/refinery.webp";
import barracksLevels from "../assets/building-levels/barracks.webp";
import vehicleFactoryLevels from "../assets/building-levels/vehicleFactory.webp";
import { useEffect, useRef, useState, useId } from "react";
import gameArtwork from "../assets/game-art.png";
import logisticsArtwork from "../assets/logistics-art.png";

export const resourceLabels = {
  wood: "Holz",
  stone: "Stein",
  food: "Nahrung",
  oil: "Öl",
};
export const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (!Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return [
    h ? `${h} Std.` : "",
    m ? `${m} Min.` : "",
    s || (!h && !m) ? `${s} Sek.` : "",
  ]
    .filter(Boolean)
    .join(" ");
};
export const quoteText = (quote) =>
  `${quote.cost.wood} Holz · ${quote.cost.stone} Stein · ${formatDuration(quote.durationMs)}${quote.researchEffect ? ` · Forschung Stufe ${quote.researchEffect.level}: +${(quote.researchEffect.level * quote.researchEffect.bonusBps) / 100} % Geschwindigkeit · ${Math.round((1 - quote.durationMs / quote.researchEffect.durationWithoutResearchMs) * 1000) / 10} % Zeitersparnis` : ""}`;
export const canAfford = (state, quote) =>
  Object.entries(quote.cost).every(
    ([resource, amount]) => state.city.resources[resource] >= amount,
  );
export const capacitySummary = (capacities) =>
  Object.entries(capacities)
    .map(([resource, value]) => `${resourceLabels[resource]} ${value}`)
    .join(" · ");

export function ActionButton({ label, detail, disabled, onClick }) {
  return (
    <button
      type="button"
      className="action"
      disabled={disabled}
      onClick={onClick}
    >
      <strong>{label}</strong>
      <span>{detail}</span>
    </button>
  );
}
const artPositions = {
  university: [100, 100],
  sawmill: [0, 0],
  quarry: [50, 0],
  farm: [100, 0],
  warehouse: [0, 50],
  barracks: [50, 50],
  scout: [100, 50],
  infantry: [0, 100],
  general: [50, 100],
  town: [100, 100],
};
export function GameArt({ type, label, className = "" }) {
  const logisticsPositions = { refinery: 0, vehicleFactory: 50, truck: 100 };
  if (type in logisticsPositions)
    return (
      <span
        className={`game-art ${className}`}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{
          backgroundImage: `url(${logisticsArtwork})`,
          backgroundSize: "300% 100%",
          backgroundPosition: `${logisticsPositions[type]}% 0%`,
        }}
      />
    );
  const [x, y] = artPositions[type] ?? artPositions.town;
  return (
    <span
      className={`game-art ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        backgroundImage: `url(${gameArtwork})`,
        backgroundPosition: `${x}% ${y}%`,
      }}
    />
  );
}
const buildingAtlases = {
  sawmill: sawmillLevels,
  quarry: quarryLevels,
  farm: farmLevels,
  warehouse: warehouseLevels,
  university: universityLevels,
  refinery: refineryLevels,
  barracks: barracksLevels,
  vehicleFactory: vehicleFactoryLevels,
};
export function BuildingArt({ type, level = 1 }) {
  const frame = buildingArtFrame(type, level);
  return (
    <span
      className="game-art building-art"
      role="img"
      aria-label={frame.label}
      data-building-type={type}
      data-building-level={level}
      style={{
        backgroundImage: `url(${buildingAtlases[type]})`,
        backgroundSize: frame.backgroundSize,
        backgroundPosition: frame.backgroundPosition,
      }}
    />
  );
}

export function Dialog({
  open,
  title,
  kicker,
  danger = false,
  className = "",
  onClose,
  children,
  actions,
  dirty = false,
}) {
  const ref = useRef(null);
  const returnFocus = useRef(null);
  const [discard, setDiscard] = useState(false);
  const titleId = useId();
  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement;
      dialog.showModal();
      dialog.querySelector("input,select,button")?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    const close = () => {
      onClose();
      returnFocus.current?.focus?.();
    };
    const cancel = (event) => {
      event.preventDefault();
      if (discard) setDiscard(false);
      else requestClose();
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("close", close);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("close", close);
    };
  }, [onClose, dirty, discard]);
  useEffect(
    () => () => {
      returnFocus.current?.focus?.();
    },
    [],
  );
  return (
    <dialog
      ref={ref}
      className={`mission-dialog${danger ? " danger-dialog" : ""}${className ? ` ${className}` : ""}`}
      aria-labelledby={titleId}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <span className="kicker">{kicker}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Dialog schließen"
            onClick={requestClose}
          >
            ×
          </button>
        </div>
        {discard ? (
          <>
            <p>Ungesendete Eingaben verwerfen?</p>
            <div className="dialog-actions">
              <button onClick={() => setDiscard(false)}>Bleiben</button>
              <button onClick={onClose}>Entwurf verwerfen</button>
            </div>
          </>
        ) : (
          <>
            {children}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={requestClose}
              >
                Abbrechen
              </button>
              {actions}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
