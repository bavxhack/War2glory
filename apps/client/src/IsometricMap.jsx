import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cameraAnchor, clampCamera, mergeMapCache, missingChunks, moveCamera, project, tileAtScreen } from '../isometric-map.js';
import { IsometricScene } from './IsometricScene.jsx';
import { MapCompass } from './MapCompass.jsx';

export function IsometricMap({ map, cityId, transport, selection }) {
  const [cache,setCache]=useState(()=>mergeMapCache({revision:null,terrain:new Map(),entities:new Map()},map));
  const bounds=map?.bounds??{width:24,height:24};
  const [camera,setCamera]=useState(()=>clampCamera(map?.ownCity??{x:12,y:12},bounds)),[tileWidth,setTileWidth]=useState(() => window.innerWidth <= 560 ? 208 : 240),[coordinate,setCoordinate]=useState(''),[toolsOpen,setToolsOpen]=useState(false),[frame,setFrame]=useState({width:700,height:500}),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const frameRef=useRef(null),cameraRef=useRef(camera),cacheRef=useRef(cache),widthRef=useRef(tileWidth),boundsRef=useRef(bounds),frameSize=useRef(frame),ownRef=useRef(map?.ownCity),initialized=useRef(Boolean(map?.ownCity)),flight=useRef(null),requestAt=useRef(0);
  cacheRef.current=cache;widthRef.current=tileWidth;boundsRef.current=bounds;frameSize.current=frame;ownRef.current=map?.ownCity??ownRef.current;
  const position=useCallback(point=>{const next=clampCamera(point,boundsRef.current);cameraRef.current=next;setCamera(next);},[]);
  const move=useCallback((direction,pixels)=>{const next=moveCamera(cameraRef.current,direction,pixels,boundsRef.current,widthRef.current);if(next.x!==cameraRef.current.x||next.y!==cameraRef.current.y)position(next);},[position]);
  useEffect(()=>{
    if(!map)return;
    setCache(previous=>mergeMapCache(previous,map));
    if(!initialized.current&&map.ownCity){initialized.current=true;position(map.ownCity);}
    const v=flight.current?.viewport;
    if(v&&['x','y','width','height'].every(k=>v[k]===map.viewport?.[k]))flight.current=null;
  },[map,position]);
  useEffect(()=>{
    const element=frameRef.current,observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setFrame({width:r.width,height:r.height});});observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const interval=setInterval(()=>{
      const now=performance.now();
      if(flight.current&&now-flight.current.at<1800)return;
      flight.current=null;
      const chunks=missingChunks(cameraRef.current,frameSize.current,boundsRef.current,cacheRef.current.terrain,widthRef.current);
      setLoading(chunks.length>0);
      if(!chunks.length||now-requestAt.current<110)return;
      const viewport=chunks[0];
      try{transport.requestMap(viewport);requestAt.current=now;flight.current={viewport,at:now};setError('');}catch(cause){setError(cause.message);}
    },110);
    return()=>{clearInterval(interval);flight.current=null;};
  },[transport,cityId]);
  const select=useCallback((entity,terrain)=>{transport.setMapDetails({entity,terrain});if(entity)transport.details(entity.id);},[transport]);
  const selected=selection?.terrain?`${selection.terrain.x}:${selection.terrain.y}`:null;
  const scene=useMemo(()=><IsometricScene cache={cache} bounds={bounds} tileWidth={tileWidth} selected={selected} onSelect={select}/>,[cache,bounds.width,bounds.height,tileWidth,selected,select]);
  const center=project(camera,tileWidth);
  const search=event=>{event.preventDefault();const parts=coordinate.match(/^\s*(\d+)\s*[,; ]\s*(\d+)\s*$/);if(!parts){setError('Koordinate als x, y eingeben.');return;}position({x:Number(parts[1]),y:Number(parts[2])});setError('');};
  return <div className="iso-map-window">
    <div className="iso-toolbar"><div><span className="kicker">GEMEINSAME WELT</span><h2 id="world-heading">Weltkarte</h2></div><details className="iso-tools" open={toolsOpen} onToggle={event=>setToolsOpen(event.currentTarget.open)}><summary>Suche &amp; Maßstab</summary><div className="iso-tool-content"><form onSubmit={search}><label>Koordinate<input value={coordinate} onChange={event=>setCoordinate(event.target.value)} placeholder="12, 8" inputMode="numeric"/></label><button>Suchen</button></form><button aria-label="Verkleinern" disabled={tileWidth<=160} onClick={()=>setTileWidth(w=>Math.max(160,w-32))}>−</button><output aria-label="Kartenmaßstab">{Math.round(tileWidth/240*100)} %</output><button aria-label="Vergrößern" disabled={tileWidth>=320} onClick={()=>setTileWidth(w=>Math.min(320,w+32))}>+</button></div></details></div>
    <div className="iso-map-frame" ref={frameRef} data-camera-x={camera.x.toFixed(5)} data-camera-y={camera.y.toFixed(5)} data-tile-width={tileWidth}>
      <MapCompass camera={camera} bounds={bounds} tileWidth={tileWidth} onMove={move} onHome={()=>ownRef.current&&position(ownRef.current)}/>
      <div className="iso-map-hud"><span>Welt {bounds.width} × {bounds.height}</span><output aria-label="Kameraposition">Kamera {camera.x.toFixed(1)}, {camera.y.toFixed(1)}</output>{selected&&<span data-selected-coordinate={selected}>Auswahl {selection.entity?.name??selected}</span>}{loading&&<span role="status">Karte lädt …</span>}</div>
      <svg className="isometric-map" width="100%" height="100%" viewBox={`0 0 ${frame.width} ${frame.height}`} role="group" aria-label="Isometrische Weltkarte mit Städten und Feldern" onClick={event=>{if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect(),tile=tileAtScreen({x:event.clientX-rect.left,y:event.clientY-rect.top},cameraRef.current,frameSize.current,widthRef.current),terrain=cacheRef.current.terrain.get(`${tile.x}:${tile.y}`);if(terrain)select(cacheRef.current.entities.get(`${tile.x}:${tile.y}`),terrain);}}>
        <g className="iso-camera" transform={`translate(${cameraAnchor(frame).x-center.x} ${cameraAnchor(frame).y-center.y})`}>{scene}</g>
      </svg>
      {error&&<p className="iso-map-error" role="alert">{error}</p>}
    </div>
  </div>;
}
