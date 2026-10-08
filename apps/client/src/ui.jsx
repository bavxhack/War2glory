import { useEffect, useRef } from 'react';

export const resourceLabels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung' };
export const formatDuration = milliseconds => `${Math.max(0, Math.ceil(milliseconds / 1000))} s`;
export const quoteText = quote => `${quote.cost.wood} Holz · ${quote.cost.stone} Stein · ${formatDuration(quote.durationMs)}`;
export const canAfford = (state, quote) => Object.entries(quote.cost).every(([resource, amount]) => state.city.resources[resource] >= amount);
export const capacitySummary = capacities => Object.entries(capacities).map(([resource, value]) => `${resourceLabels[resource]} ${value}`).join(' · ');

export function ActionButton({ label, detail, disabled, onClick }) { return <button type="button" className="action" disabled={disabled} onClick={onClick}><strong>{label}</strong><span>{detail}</span></button>; }
export function BuildingArt({ type }) {
  return <img className="building-art" src={`/assets/buildings/${type}.svg`} alt="" aria-hidden="true"/>;
}

export function Dialog({ open, title, kicker, danger = false, onClose, children, actions }) {
  const ref = useRef(null); const returnFocus = useRef(null);
  useEffect(() => { const dialog = ref.current; if (open && !dialog.open) { returnFocus.current = document.activeElement; dialog.showModal(); dialog.querySelector('input,select,button')?.focus(); } else if (!open && dialog.open) dialog.close(); }, [open]);
  useEffect(() => { const dialog = ref.current; const close = () => { onClose(); returnFocus.current?.focus?.(); }; dialog.addEventListener('cancel', close); dialog.addEventListener('close', close); return () => { dialog.removeEventListener('cancel', close); dialog.removeEventListener('close', close); }; }, [onClose]);
  return <dialog ref={ref} className={`mission-dialog${danger ? ' danger-dialog' : ''}`} aria-labelledby={`${kicker}-title`}><div className="dialog-content"><div className="dialog-heading"><div><span className="kicker">{kicker}</span><h2 id={`${kicker}-title`}>{title}</h2></div><button type="button" className="dialog-close" aria-label="Dialog schließen" onClick={onClose}>×</button></div>{children}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Abbrechen</button>{actions}</div></div></dialog>;
}
