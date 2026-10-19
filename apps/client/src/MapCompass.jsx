import { useEffect, useRef, useState } from 'react';
import { MAP_DIRECTIONS } from '../map-navigation.js';
import { CAMERA_STEP_PX, canMoveCamera, createCompassMotion } from '../isometric-map.js';

export function MapCompass({ camera, bounds, tileWidth, onMove, onHome }) {
  const move=useRef(onMove);move.current=onMove;
  const motion=useRef(null);motion.current??=createCompassMotion((direction,pixels)=>move.current(direction,pixels));
  const frame=useRef(null),[pressed,setPressed]=useState(null);
  const stop=()=>{motion.current.stop();cancelAnimationFrame(frame.current);frame.current=null;setPressed(null);};
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)stop();};
    const releaseKey=event=>{if(['Enter',' '].includes(event.key))stop();};
    window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('keyup',releaseKey);
    window.addEventListener('blur',stop);document.addEventListener('visibilitychange',visibility);
    return()=>{motion.current.stop();cancelAnimationFrame(frame.current);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('keyup',releaseKey);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const begin=direction=>{
    motion.current.stop();cancelAnimationFrame(frame.current);
    motion.current.start(direction,performance.now());setPressed(direction.short);
    const tick=now=>{motion.current.tick(now);if(motion.current.active)frame.current=requestAnimationFrame(tick);};
    frame.current=requestAnimationFrame(tick);
  };
  return <nav className="iso-compass" aria-label="Windrose zur Kartenbewegung" onClick={event=>event.stopPropagation()}>
    <span className="compass-heading">Kamera bewegen</span>
    <div className="iso-compass-grid">{MAP_DIRECTIONS.map(direction=><button type="button" key={direction.short} aria-label={`Karte nach ${direction.label}`} aria-pressed={pressed===direction.short} disabled={!canMoveCamera(camera,bounds,direction,tileWidth)}
      style={{gridColumn:direction.x+2,gridRow:direction.y+2}}
      onPointerDown={event=>{if(event.button!==0||!event.isPrimary)return;event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);begin(direction);}}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
      onKeyDown={event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(!event.repeat)begin(direction);}}}
      onKeyUp={event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();stop();}}}
      onClick={event=>{if(event.detail===0)move.current(direction,CAMERA_STEP_PX);}}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={{transform:`rotate(${Math.atan2(direction.x,-direction.y)*180/Math.PI}deg)`}}><path d="M12 20V4m-6 6 6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><small>{direction.short}</small>
    </button>)}<button type="button" className="iso-compass-home" aria-label="Zur eigenen Stadt" style={{gridColumn:2,gridRow:2}} onClick={()=>{stop();onHome();}}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg><small>Stadt</small></button></div>
    <span className="compass-footnote">Halten = weiterfahren</span>
  </nav>;
}
