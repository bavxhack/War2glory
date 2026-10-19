import { resourceCapacities } from './index.js';
export const TASK_CATALOG_VERSION = 'tasks-1-provisional';
const t = (id, title, explanation, prerequisites, reward, action) =>
  Object.freeze({
    id,
    title,
    explanation,
    prerequisites: Object.freeze(
      prerequisites.map((p) => (p.includes('.') ? p : `intro.${p}`)),
    ),
    reward: Object.freeze(
      Object.fromEntries(
        ['wood', 'stone', 'food', 'oil'].map((k, i) => [k, reward[i]]),
      ),
    ),
    action,
  });
// Own provisional prototype values, not reconstructed War2Glory values.
export const TASKS = Object.freeze([
  t(
    'intro.farm',
    'Bauernhof Stufe 2',
    'Ein fertiger Bauernhof Stufe 2 verbessert die Nahrung.',
    [],
    [100, 100, 150, 0],
    'city',
  ),
  t(
    'intro.storage',
    'Lagerhaus errichten',
    'Ein fertiges Lagerhaus Stufe 1 schafft Platz für Vorräte.',
    ['farm'],
    [100, 100, 150, 0],
    'city',
  ),
  t(
    'intro.mayor',
    'Bürgermeister einsetzen',
    'Einen freien General in seiner Stadt als Bürgermeister einsetzen. Führung verbessert Nahrung; vor Forschung oder Reisen wieder freigeben.',
    ['farm'],
    [50, 50, 200, 0],
    'generals',
  ),
  t(
    'intro.university',
    'Universität errichten',
    'Eine fertige Universität auf einem zivilen Bauplatz ermöglicht Forschung.',
    ['storage'],
    [150, 150, 100, 0],
    'city',
  ),
  t(
    'intro.research',
    'Erste Forschung abschließen',
    'In Forschung eine freie Leitung am Ort einsetzen und eine Stufe abschließen.',
    ['university'],
    [100, 100, 150, 0],
    'research',
  ),
  t(
    'intro.oil',
    'Ölwirtschaft aufbauen',
    'Universität 1 und Forschungsleitung für Ölverarbeitung 1; danach eine Ölraffinerie errichten. Ölproduktion ermöglicht Reisen.',
    ['research'],
    [100, 100, 100, 50],
    'research',
  ),
  t(
    'intro.training',
    '10 Infanteristen ausbilden',
    'Im Militär eine Kaserne auf einem freien Militärbauplatz errichten. Insgesamt 10 Infanteristen fertig ausbilden; Vorräte und Versorgung prüfen.',
    ['oil'],
    [100, 100, 150, 50],
    'military',
  ),
  t(
    'intro.scout',
    'NPC aufklären',
    'Freie Späher aus der Kaserne und freien General am Ort wählen. Öl und Rückwegreserve prüfen. Erst der zurückgekehrte NPC-Bericht zählt.',
    ['oil'],
    [100, 100, 150, 50],
    'world',
  ),
  t(
    'intro.raid',
    'Nahrung erbeuten',
    'Erst aufklären, Garnison und Kampfvorschau beachten: 10 Infanteristen reichen nicht für jeden NPC. Freien General, Öl, Ladung, Rückwegreserve und Lagerplatz prüfen. Sieg und mindestens 1 eingelagerte geplünderte Nahrung erforderlich.',
    ['training', 'scout'],
    [150, 150, 150, 50],
    'world',
  ),
  t(
    'expansion.engineering',
    'Technik erforschen',
    'Bautechnik, Ausbildungstechnik oder Ladetechnik Stufe 1 abschließen. Voraussetzungen im Forschungsbaum prüfen.',
    ['research'],
    [200, 200, 200, 0],
    'research',
  ),
  t(
    'expansion.city',
    'Zweite Stadt gründen',
    'Freies Feld aufklären, erobern und Gründungsgebühr bezahlen; zwei fertige eigene Städte erforderlich.',
    ['raid'],
    [200, 200, 200, 0],
    'world',
  ),
  t(
    'expansion.supply',
    'Eigene Stadt versorgen',
    'Aus einer anderen eigenen Stadt Nahrung mit LKWs liefern. Lagerlogistik, Motorisierung, Fahrzeugfabrik und LKW-Ausbildung ermöglichen dies. Öl, Traglast und Rückwegreserve prüfen. Kein General nötig. Mindestens 1 Nahrung muss angenommen werden.',
    ['expansion.city'],
    [100, 100, 150, 0],
    'logistics',
  ),
]);
export function newTasks(at) {
  return {
    schemaVersion: 1,
    catalogVersion: TASK_CATALOG_VERSION,
    activatedAt: at,
    training: {},
    evidence: {},
    completed: {},
    migrationNote:
      'Ereignisse zählen ab Aktivierung. Eindeutige gespeicherte Rückkehrberichte und eigene Lieferbelege wurden übernommen; historische Ausbildung wird nicht aus Truppenbeständen geschätzt.',
  };
}
export function validateTasks(s, cityIds) {
  const object = (value) =>
    value && typeof value === 'object' && !Array.isArray(value);
  if (
    !s ||
    s.schemaVersion !== 1 ||
    s.catalogVersion !== TASK_CATALOG_VERSION ||
    !Number.isFinite(s.activatedAt) ||
    !object(s.training) ||
    !object(s.evidence) ||
    !object(s.completed)
  )
    throw new Error('Unbekannter oder beschädigter Aufgabenstand.');
  if (
    Object.keys(s.training).length > 5 ||
    (cityIds && Object.keys(s.training).some((id) => !cityIds.includes(id))) ||
    Object.values(s.training).some(
      (n) => !Number.isSafeInteger(n) || n < 0 || n > 10,
    )
  )
    throw new Error('Ungültiger Ausbildungsnachweis.');
  for (const [id, v] of Object.entries(s.evidence))
    if (!TASKS.some((t) => t.id === id) || v !== true)
      throw new Error('Ungültiger Aufgabennachweis.');
  for (const [id, c] of Object.entries(s.completed))
    if (
      !TASKS.some((t) => t.id === id) ||
      !object(c) ||
      !s.evidence[id] ||
      !TASKS.find((t) => t.id === id).prerequisites.every(
        (key) => s.completed[key],
      ) ||
      !Number.isFinite(c.completedAt) ||
      typeof c.catalogVersion !== 'string' ||
      ['wood', 'stone', 'food', 'oil'].some(
        (k) => !Number.isSafeInteger(c.reward?.[k]) || c.reward[k] < 0,
      ) ||
      (c.claim &&
        (!Number.isFinite(c.claim.claimedAt) ||
          typeof c.claim.cityId !== 'string' ||
          typeof c.claim.requestId !== 'string' ||
          !object(c.claim.result) ||
          c.claim.result.taskId !== id ||
          c.claim.result.cityId !== c.claim.cityId ||
          c.claim.result.claimedAt !== c.claim.claimedAt ||
          c.claim.result.catalogVersion !== c.catalogVersion ||
          ['wood', 'stone', 'food', 'oil'].some(
            (k) => c.claim.result.reward?.[k] !== c.reward[k],
          )))
    )
      throw new Error('Ungültiger Aufgabenanspruch.');
}
export function completeTasks(s, at) {
  if (!s) return;
  if (Object.values(s.training).reduce((a, b) => a + b, 0) >= 10)
    s.evidence['intro.training'] = true;
  for (const t of TASKS)
    if (
      s.evidence[t.id] &&
      t.prerequisites.every((id) => s.completed[id]) &&
      !s.completed[t.id]
    )
      s.completed[t.id] = {
        completedAt: at,
        catalogVersion: TASK_CATALOG_VERSION,
        reward: { ...t.reward },
      };
}
// Jobs are counted in the transaction that removes them. Counters saturate at 10 per city.
export function recordTaskTraining(p, jobs, at) {
  if (!p.tasks) return;
  const n = jobs
    .filter((j) => j.unit === 'infantry' && j.finishesAt >= p.tasks.activatedAt)
    .reduce((sum, j) => sum + j.amount, 0);
  if (n)
    p.tasks.training[p.cityId] = Math.min(
      10,
      (p.tasks.training[p.cityId] ?? 0) + n,
    );
  completeTasks(p.tasks, at);
}
export function observeTaskCity(p, at) {
  if (!p.tasks) return;
  const slots = [...p.city.buildingSlots, ...(p.city.militarySlots ?? [])],
    has = (b, l = 1) => slots.some((s) => s.building === b && s.level >= l),
    levels = p.city.research?.levels ?? {};
  const e = {
    'intro.farm': has('farm', 2),
    'intro.storage': has('warehouse'),
    'intro.university': has('university'),
    'intro.oil': levels.oilProcessing >= 1 && has('refinery'),
    'intro.research': Object.values(levels).some((n) => n > 0),
    'intro.mayor': p.military.generals.some(
      (g) =>
        g.id === p.military.mayorGeneralId &&
        g.status === 'mayor' &&
        g.cityId === p.cityId,
    ),
    'expansion.engineering': [
      'constructionEngineering',
      'trainingTechniques',
      'loadingTechniques',
    ].some((k) => levels[k] >= 1),
  };
  for (const [id, reached] of Object.entries(e))
    if (reached) p.tasks.evidence[id] = true;
  completeTasks(p.tasks, at);
}
export function observeTaskRecords(p, at) {
  if (!p.tasks) return;
  if (p.cities.length >= 2) p.tasks.evidence['expansion.city'] = true;
  for (const r of p.military.reports) {
    if (
      (r.type === 'scout' ||
        (!r.type &&
          p.military.missions.some(
            (m) =>
              m.id === r.missionId &&
              m.type === 'scout' &&
              m.status === 'completed',
          ))) &&
      Number.isFinite(r.returnedAt) &&
      r.intelligence
    )
      p.tasks.evidence['intro.scout'] = true;
    if (
      r.type === 'raid' &&
      r.victory &&
      Number.isFinite(r.returnedAt) &&
      r.storedFood >= 1
    )
      p.tasks.evidence['intro.raid'] = true;
    if (
      r.type === 'delivery' &&
      r.originCityId !== r.targetCityId &&
      [r.originCityId, r.targetCityId].every((id) =>
        p.cities.some((c) => c.id === id),
      ) &&
      r.delivered?.food >= 1 &&
      Number.isFinite(r.returnedAt)
    )
      p.tasks.evidence['expansion.supply'] = true;
  }
  for (const m of p.military.missions)
    if (
      m.type === 'delivery' &&
      m.targetPlayerId === p.playerId &&
      m.originCityId !== m.targetCityId &&
      p.cities.some((c) => c.id === m.targetCityId) &&
      m.delivered?.food >= 1
    )
      p.tasks.evidence['expansion.supply'] = true;
  completeTasks(p.tasks, at);
}
export function mergeTaskEvidence(a, b, at) {
  if (!a || !b) return;
  for (const [id, n] of Object.entries(b.training))
    a.training[id] = Math.max(a.training[id] ?? 0, n);
  Object.assign(a.evidence, b.evidence);
  for (const [id, c] of Object.entries(b.completed)) a.completed[id] ??= c;
  completeTasks(a, at);
}
export function taskSnapshot(p) {
  const s = p.tasks,
    list = TASKS.map((t) => {
      const c = s.completed[t.id];
      return {
        ...t,
        reward: c?.reward ?? t.reward,
        catalogVersion: c?.catalogVersion ?? TASK_CATALOG_VERSION,
        completedAt: c?.completedAt,
        claim: c?.claim,
        status: c?.claim
          ? 'claimed'
          : c
            ? 'completed'
            : t.prerequisites.every((id) => s.completed[id])
              ? 'available'
              : 'locked',
        reached: !!s.evidence[t.id],
        progress:
          t.id === 'intro.training'
            ? Math.min(
                10,
                Object.values(s.training).reduce((a, b) => a + b, 0),
              )
            : s.evidence[t.id]
              ? 1
              : 0,
        target: t.id === 'intro.training' ? 10 : 1,
      };
    });
  return {
    catalogVersion: s.catalogVersion,
    activatedAt: s.activatedAt,
    migrationNote: s.migrationNote,
    list,
    claimable: list.filter((t) => t.status === 'completed').length,
    introComplete: list
      .filter((t) => t.id.startsWith('intro.'))
      .every((t) => s.completed[t.id]),
  };
}
export function claimTask(p, taskId, cityId, requestId, at) {
  const c = p.tasks.completed[taskId];
  if (!TASKS.some((t) => t.id === taskId) || !c)
    throw new Error('Aufgabe ist noch nicht erfüllt oder unbekannt.');
  if (c.claim) throw new Error('Belohnung bereits abgeholt.');
  if (p.cityId !== cityId) throw new Error('Unbekannte oder fremde cityId.');
  const caps = resourceCapacities(p.city),
    labels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung', oil: 'Öl' },
    missing = Object.entries(c.reward)
      .filter(([k, n]) => n > 0 && p.city.resources[k] + n > caps[k])
      .map(
        ([k, n]) =>
          `${labels[k]}: ${Math.ceil(p.city.resources[k] + n - caps[k])} Platz fehlt`,
      );
  if (missing.length)
    throw new Error(
      `Nicht genug Lagerplatz: ${missing.join(', ')}. Andere Stadt wählen oder später abholen.`,
    );
  for (const [k, n] of Object.entries(c.reward)) p.city.resources[k] += n;
  const result = {
    taskId,
    cityId,
    reward: { ...c.reward },
    catalogVersion: c.catalogVersion,
    claimedAt: at,
  };
  c.claim = { claimedAt: at, cityId, requestId, result };
  return result;
}
