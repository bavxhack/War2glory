import atlas from '../assets/isometric-world.webp';
import { project } from '../isometric-map.js';
import { mapEntityLabel } from './WorldTileArt.jsx';

const terrainNames={plains:'Ebene',forest:'Wald',hills:'Hügel',water:'Wasser'};
const colors={plains:'#a4b579',forest:'#799466',hills:'#aaa57d',water:'#5994a2'};
function Sprite({ kind, width }) {
  const index={ 'own-city':0,'player-city':1,npc:2,forest:3,hills:4,plains:5 }[kind];
  return <svg x={-width/2} y={-width*.78} width={width} height={width} viewBox={`${(index%3)*400} ${Math.floor(index/3)*400} 400 400`} overflow="hidden" data-sprite-width={width} className="iso-sprite" pointerEvents="none" aria-hidden="true"><image href={atlas} width="1200" height="800"/></svg>;
}

export function IsometricScene({ cache, bounds, tileWidth, selected, onSelect }) {
  const w=tileWidth/2,h=tileWidth/4;
  const fields=[];for(let y=0;y<bounds.height;y++)for(let x=0;x<bounds.width;x++)fields.push({x,y});
  const painted=[...cache.terrain.values()].sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);
  const labels=[];
  for(const t of painted){const e=cache.entities.get(`${t.x}:${t.y}`);if(!e)continue;const p=project(t,tileWidth);let y=p.y+h+4;const x=p.x-70;
    for(let tries=0;tries<20&&labels.some(l=>Math.abs(l.x-x)<142&&Math.abs(l.y-y)<48);tries++)y+=10;
    labels.push({x,y,anchor:p,entity:e});
  }
  const boundary=[[-.5,-.5],[bounds.width-.5,-.5],[bounds.width-.5,bounds.height-.5],[-.5,bounds.height-.5]].map(([x,y])=>{const p=project({x,y},tileWidth);return `${p.x},${p.y}`;}).join(' ');
  const select=(event,key)=>{event.stopPropagation();const t=cache.terrain.get(key);if(t)onSelect(cache.entities.get(key),t);};
  const keyboard=(event,key)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(event,key);}};
  return <>
    <defs><linearGradient id="iso-light" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5e9b2" stopOpacity=".35"/><stop offset="1" stopColor="#263d2a" stopOpacity=".22"/></linearGradient><pattern id="iso-grain" width="19" height="13" patternUnits="userSpaceOnUse"><path d="m3 8 3-1m7-4 2 1" stroke="#f9edb4" strokeWidth=".6" opacity=".2"/></pattern></defs>
    <polygon points={boundary} transform="translate(0 9)" fill="#343e32" stroke="#1e3838" strokeWidth="8"/>
    <g className="iso-ground-layer">{fields.map(t=>{const key=`${t.x}:${t.y}`,terrain=cache.terrain.get(key),e=cache.entities.get(key),p=project(t,tileWidth),points=`0,${-h} ${w},0 0,${h} ${-w},0`;
      return <g key={key} transform={`translate(${p.x} ${p.y})`}>
        <polygon className={`iso-ground${selected===key?' is-selected':''}${terrain?'':' is-loading'}`} points={points} fill={colors[terrain?.type]??'#738573'} stroke="#435f46" strokeOpacity=".28" strokeWidth=".8" data-map-coordinate={key} data-terrain={terrain?.type??'loading'} role="button" tabIndex={terrain?0:-1} aria-disabled={!terrain} aria-pressed={selected===key} aria-label={`${e?`${e.name}, ${mapEntityLabel(e.type)}`:terrainNames[terrain?.type]??'Feld wird geladen'}, ${t.x}, ${t.y}`} onClick={event=>select(event,key)} onKeyDown={event=>keyboard(event,key)}/>
        <polygon points={points} fill="url(#iso-light)" pointerEvents="none"/>
        {terrain?.type!=='water'&&<polygon points={points} fill="url(#iso-grain)" pointerEvents="none"/>}
        {terrain&&!e&&<text x="0" y={h-8} textAnchor="middle" className="iso-coordinate" pointerEvents="none">{t.x},{t.y}</text>}
        {terrain?.type==='water'&&<g pointerEvents="none"><path d={`M${-w*.6} 0q${w*.3} -8 ${w*.6} 0t${w*.6} 0M${-w*.25} 14h${w*.6}`} stroke="#cbe8dc" strokeOpacity=".5" fill="none"/>{[[1,0,`${w},0 0,${h}`],[0,1,`0,${h} ${-w},0`],[-1,0,`${-w},0 0,${-h}`],[0,-1,`0,${-h} ${w},0`]].map(([dx,dy,edge])=>cache.terrain.get(`${t.x+dx}:${t.y+dy}`)?.type&&cache.terrain.get(`${t.x+dx}:${t.y+dy}`).type!=='water'?<polyline key={edge} points={edge} stroke="#d7c392" strokeWidth="6" fill="none"/>:null)}</g>}
      </g>;
    })}</g>
    <polygon points={boundary} fill="none" stroke="#e1cea0" strokeWidth="2.5" pointerEvents="none"/>
    <g className="iso-object-layer">{painted.map(t=>{const key=`${t.x}:${t.y}`,e=cache.entities.get(key),p=project(t,tileWidth),kind=e?.type??t.type;
      if(kind==='water'||kind==='plains'&&(t.x*3+t.y)%7!==0)return null;
      return <g key={key} className={`iso-object ${e?'iso-city':''}`} data-map-coordinate={key} data-entity-type={e?.type} data-depth={t.x+t.y} transform={`translate(${p.x} ${p.y})`} role={e?'button':undefined} tabIndex={e?0:undefined} aria-label={e?`${e.name}, ${mapEntityLabel(e.type)}, ${t.x}, ${t.y}`:undefined} onClick={event=>select(event,key)} onKeyDown={event=>keyboard(event,key)}>
        <path className="iso-object-hit" d={e?`M${-tileWidth*.37} 0 ${-tileWidth*.32} ${-tileWidth*.34} ${-tileWidth*.1} ${-tileWidth*.43} 0 ${-tileWidth*.62} ${tileWidth*.13} ${-tileWidth*.4} ${tileWidth*.35} ${-tileWidth*.32} ${tileWidth*.37} 0 0 ${tileWidth*.17}Z`:`M${-tileWidth*.31} 0 ${-tileWidth*.27} ${-tileWidth*.4} 0 ${-tileWidth*.53} ${tileWidth*.3} ${-tileWidth*.35} ${tileWidth*.31} 0 0 ${tileWidth*.14}Z`} fill="transparent" pointerEvents="all"/>
        {kind==='claim'?<g><ellipse cy="8" rx="20" ry="7" fill="#263e2a66"/><path d="M0 8v-65l28 10L0-36" fill="#e5ca7c" stroke="#6d5739" strokeWidth="3"/></g>:<Sprite kind={kind} width={tileWidth*(e ? .8 : kind==='hills' ? .8 : kind==='forest' ? .65 : .7)}/>}
      </g>;
    })}</g>
    {selected&&(()=>{const [x,y]=selected.split(':').map(Number),p=project({x,y},tileWidth);return <polygon className="iso-selection-outline" points={`0,${-h} ${w},0 0,${h} ${-w},0`} transform={`translate(${p.x} ${p.y})`} fill="#ffe58418" stroke="#ffe68c" strokeWidth="3" pointerEvents="none"/>;})()}
    <g pointerEvents="none" className="iso-label-layer">
      {labels.map(({x,y,anchor,entity:e})=><g key={e.id??`${e.x}:${e.y}`} className="iso-label" pointerEvents="all" data-map-coordinate={`${e.x}:${e.y}`} role="button" tabIndex="0" aria-label={`${e.name}, ${e.x}, ${e.y}`} onClick={event=>select(event,`${e.x}:${e.y}`)} onKeyDown={event=>keyboard(event,`${e.x}:${e.y}`)}><path d={`M${anchor.x} ${anchor.y+h*.65}V${y+2}`} stroke="#f4e3b4" strokeOpacity=".7"/><foreignObject x={x} y={y} width="140" height="48"><div xmlns="http://www.w3.org/1999/xhtml" className={`iso-city-label ${e.type}`}><strong>{e.type==='own-city'?'★':e.type==='npc'?'⬟':e.type==='claim'?'⚑':'◆'} {e.alliance ? `[${e.alliance.tag}] ` : ''}{e.name}</strong><small>{e.allied && e.type !== 'own-city' ? 'Bündnispartner' : mapEntityLabel(e.type)} · {e.x},{e.y}</small></div></foreignObject></g>)}
    </g>
  </>;
}
