import { useEffect, useRef } from 'react';
import gameArtwork from '../assets/game-art.png';
import logisticsArtwork from '../assets/logistics-art.png';

export const resourceLabels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung', oil: 'Öl' };
export const formatDuration = milliseconds => `${Math.max(0, Math.ceil(milliseconds / 1000))} s`;
export const quoteText = quote => `${quote.cost.wood} Holz · ${quote.cost.stone} Stein · ${formatDuration(quote.durationMs)}`;
export const canAfford = (state, quote) => Object.entries(quote.cost).every(([resource, amount]) => state.city.resources[resource] >= amount);
export const capacitySummary = capacities => Object.entries(capacities).map(([resource, value]) => `${resourceLabels[resource]} ${value}`).join(' · ');

export function ActionButton({ label, detail, disabled, onClick }) { return <button type="button" className="action" disabled={disabled} onClick={onClick}><strong>{label}</strong><span>{detail}</span></button>; }
const artPositions = { university: [100, 100], sawmill: [0, 0], quarry: [50, 0], farm: [100, 0], warehouse: [0, 50], barracks: [50, 50], scout: [100, 50], infantry: [0, 100], general: [50, 100], town: [100, 100] };
export function GameArt({ type, label, className = '' }) {
  const logisticsPositions = { refinery: 0, vehicleFactory: 50, truck: 100 };
  if (type in logisticsPositions) return <span className={`game-art ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ backgroundImage: `url(${logisticsArtwork})`, backgroundSize: '300% 100%', backgroundPosition: `${logisticsPositions[type]}% 0%` }}/>;
  const [x, y] = artPositions[type] ?? artPositions.town;
  return <span className={`game-art ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ backgroundImage: `url(${gameArtwork})`, backgroundPosition: `${x}% ${y}%` }}/>;
}
export function BuildingArt({ type }) { return <GameArt type={type} className="building-art"/>; }

export function Dialog({ open, title, kicker, danger = false, onClose, children, actions }) {
  const ref = useRef(null); const returnFocus = useRef(null);
  useEffect(() => { const dialog = ref.current; if (open && !dialog.open) { returnFocus.current = document.activeElement; dialog.showModal(); dialog.querySelector('input,select,button')?.focus(); } else if (!open && dialog.open) dialog.close(); }, [open]);
  useEffect(() => { const dialog = ref.current; const close = () => { onClose(); returnFocus.current?.focus?.(); }; const cancel = event => { event.preventDefault(); dialog.close(); close(); }; dialog.addEventListener('cancel', cancel); dialog.addEventListener('close', close); return () => { dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('close', close); }; }, [onClose]);
  return <dialog ref={ref} className={`mission-dialog${danger ? ' danger-dialog' : ''}`} aria-labelledby={`${kicker}-title`}><div className="dialog-content"><div className="dialog-heading"><div><span className="kicker">{kicker}</span><h2 id={`${kicker}-title`}>{title}</h2></div><button type="button" className="dialog-close" aria-label="Dialog schließen" onClick={onClose}>×</button></div>{children}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Abbrechen</button>{actions}</div></div></dialog>;
}
