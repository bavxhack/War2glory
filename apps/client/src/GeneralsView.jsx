import { useState } from 'react';
import { GeneralList } from './MilitaryView.jsx';
import { Recruitment } from './Recruitment.jsx';
import { GeneralDialog } from './GeneralDialog.jsx';
import { SidebarActions } from './SidebarActions.jsx';
export function GeneralsView({state,transport}) {
  const [selected,setSelected] = useState(null), g = state.military.generals.find(g => g.id === selected);
  return <section><h2>Generäle · Alle Städte</h2><GeneralList generals={state.military.generals} cities={state.cities} transports={state.transports} onSelect={setSelected}/>
    <SidebarActions><section className="card"><h3>Rekrutierung in {state.city.name}</h3><Recruitment state={state} transport={transport} onSelect={setSelected}/></section></SidebarActions>
    {g && <GeneralDialog key={g.id} general={g} rules={state.generalSkillRules} supply={state.supply} roleVersion={state.military.roleVersion} isMayor={g.status === 'mayor'} local={g.cityId === state.cityId} cityName={state.cities.find(c => c.id === g.cityId)?.name} transport={transport} onClose={() => setSelected(null)}/>}
  </section>;
}
