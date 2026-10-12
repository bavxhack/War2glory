import { useCallback, useState } from 'react';
import { Dialog, GameArt } from './ui.jsx';

export function CitySwitcher({ state, transport, onSelect }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const cities = state.cities ?? [];
  const current = cities.find(c => c.id === state.cityId);
  return <>
    <button type="button" className="city-switcher" aria-label="Stadt wechseln" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <GameArt type="town"/><span className="city-switcher-text"><span className="kicker">AKTIVE STADT</span><strong>{state.city.name}</strong><small>Koordinaten {current?.x ?? '–'}, {current?.y ?? '–'}</small></span><span className="city-count">{cities.length}/5</span><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7"/></svg>
    </button>
    {open && <Dialog open className="city-switch-dialog" title="Deine Städte" kicker="STADT WECHSELN" onClose={close}><p>Wähle deine Ausgangsstadt · {cities.length} von 5 Stadtplätzen belegt.</p><div className="city-choice-list">{cities.map(city => <button type="button" className={`city-choice${city.id === state.cityId ? ' current' : ''}`} key={city.id} aria-pressed={city.id === state.cityId} aria-label={`${city.name} (${city.x}, ${city.y})`} onClick={() => { close(); if (city.id !== state.cityId) (onSelect ?? (id => transport.selectCity(id)))(city.id); }}><GameArt type="town"/><span><strong>{city.name}</strong><small>Koordinaten {city.x}, {city.y}</small></span><span className="city-choice-badge">{city.id === state.cityId ? 'Aktiv' : 'Wechseln'}</span></button>)}</div></Dialog>}
  </>;
}
