export function LoadingResearch({ preview }) {
  const r = preview.logistics?.loadingResearch;
  return r ? <p>Ladetechnik Stufe {r.level} · +{r.level * r.bonusBps / 100} % Traglast. Typkapazitäten: {Object.entries(preview.logistics.cargoPerUnit).map(([id, n]) => `${({infantry:'Infanterie',scout:'Späher',truck:'LKW'})[id] ?? id}: ${n}`).join(' · ')}. Späher- und Diensttransporttanks bleiben getrennt und unverändert.</p> : null;
}
