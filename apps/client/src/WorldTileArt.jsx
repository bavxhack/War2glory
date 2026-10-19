const cityTypes = { 'own-city': 'Eigene Stadt', 'player-city': 'Spielerstadt', npc: 'NPC-Stadt', claim: 'Reserviertes Feld' };
export const mapEntityLabel = type => cityTypes[type] ?? 'Stadt';

function Pine({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cx="5" cy="4" rx="11" ry="4" fill="#233b28" opacity=".3"/><path d="M-2 2v-24h4V2" fill="#715233"/><path d="m0-48-15 25h7l-11 16h38L8-23h7Z" fill="#295842"/><path d="m0-48 15 25H8L19-7H0Z" fill="#1d4335"/><path d="m-2-41-8 15h8Z" fill="#69916a"/></g>;
}
function House({ x, y, scale = 1, roof = '#a4573e', tower = false }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cx="4" cy="5" rx="23" ry="7" fill="#253927" opacity=".25"/>
    <path d={`M-17-4v-${tower ? 41 : 24}l18 8v${tower ? 41 : 24}Z`} fill="#e5d4a5"/><path d={`m1 4 22-12v-${tower ? 41 : 24}L1-${tower ? 37 : 20}Z`} fill="#b3a176"/>
    <path d={`m-21-${tower ? 45 : 28} 19-15 29 13-26 15Z`} fill={roof}/><path d={`m-2-${tower ? 60 : 43} 29 13-26 15Z`} fill="#613e32"/>
    <path d="M-12-20v7l5 2v-7Zm19 6v7l5-3v-7Zm9-5v7l4-2v-7Z" fill="#4a6660"/>
    <path d="M-7-1v-10l6 2V2Z" fill="#66513b"/>{tower && <path d="M-10-41v8l5 2v-8Zm18 6v8l5-3v-8Z" fill="#4a6660"/>}
  </g>;
}

export function WorldTileArt({ terrain, entity }) {
  const seed = (terrain.x * 7 + terrain.y * 11) % 5;
  const city = entity && entity.type !== 'claim';
  const roof = entity?.type === 'own-city' ? '#4d7c92' : entity?.type === 'player-city' ? '#64704b' : '#ac6445';
  return <svg className="world-relief" viewBox="0 0 160 120" aria-hidden="true" focusable="false">
    {terrain.type === 'water' ? <><path d="M0 52Q30 35 70 52t90 0M-10 75q40-17 80 0t100 0M0 98q40-17 80 0t90 0" fill="none" stroke="#b2dce0" strokeWidth="3" opacity=".6"/><path d="M12 62h24m64 20h29M63 31h25" stroke="#e1efdc" opacity=".5"/></> : <>
      <path d="M0 74Q35 42 80 70t80-12v62H0Z" fill="#709364" opacity=".45"/>
      <path d="m0 93 68-28 25 7-70 48H0Zm160-4L97 65l-16 7 79 43Z" fill="#c5b987" opacity={city ? '.9' : '.2'}/>
      {terrain.type === 'plains' && !city && <g stroke="#8caa69" strokeWidth="3" opacity=".8"><path d="m14 77 30-17m-20 27 30-17m-19 27 30-17M99 100l34-20m-23 29 33-20"/><path d="m7 48 18-11m1 17 18-11" stroke="#d2c889"/></g>}
      {terrain.type === 'hills' && !city && <><path d="m-5 95 46-68 45 68Z" fill="#a7aa7c"/><path d="m41 27 45 68H45Z" fill="#727e5b"/><path d="m65 96 39-52 60 52Z" fill="#c2b692"/><path d="m104 44 60 52h-53Z" fill="#8c8e68"/><path d="m26 50 15-23 15 23-17-8Z" fill="#dbcfac"/></>}
      {terrain.type === 'forest' && !city && [[25,82,.8],[62,68,.85],[105,76,1],[132,100,.8],[59,111,1]].map(([x,y,scale],i)=><Pine key={i} x={x+(seed-2)*2} y={y} scale={scale}/>)}
      {city && <><Pine x={20} y={74} scale={.65}/><Pine x={143} y={78} scale={.7}/><House x={56} y={59} scale={.7} roof={roof}/><House x={106} y={67} scale={.7} roof={roof}/><House x={80} y={92} scale={1} tower roof={roof}/><House x={35} y={98} scale={.65} roof={roof}/><House x={123} y={105} scale={.65} roof={roof}/><path d="M80 30V8l20 6-20 7" fill={entity.type==='own-city'?'#d6e599':entity.type==='npc'?'#e4ab67':'#98c9db'} stroke="#4d5941" strokeWidth="1.5"/></>}
      {entity?.type === 'claim' && <><ellipse cx="80" cy="94" rx="33" ry="9" fill="#354b30" opacity=".3"/><path d="M65 90V33l44 13-44 13" fill="#dfc486" stroke="#69583c" strokeWidth="3"/><path d="m40 95 40-16 38 16" fill="none" stroke="#f0d397" strokeWidth="3" strokeDasharray="5 4"/></>}
    </>}
  </svg>;
}
