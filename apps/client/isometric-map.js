export const CAMERA_STEP_PX = 64;
export const CAMERA_SPEED_PX = 170;
export const HOLD_DELAY_MS = 220;

export function cameraAnchor(frame) { return {x:frame.width/2,y:frame.height*.42}; }

export function project(point, tileWidth = 144) {
  return { x: (point.x - point.y) * tileWidth / 2, y: (point.x + point.y) * tileWidth / 4 };
}
export function unproject(point, tileWidth = 144) {
  return { x: point.x / tileWidth + point.y * 2 / tileWidth, y: point.y * 2 / tileWidth - point.x / tileWidth };
}
export function clampCamera(point, bounds) {
  if (![point.x, point.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width < 1 || bounds.height < 1) throw new TypeError('Ungültige Kameraposition oder Weltgrenzen.');
  return { x: Math.max(0, Math.min(bounds.width - 1, point.x)), y: Math.max(0, Math.min(bounds.height - 1, point.y)) };
}
export function moveCamera(camera, direction, pixels, bounds, tileWidth = 144) {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return clampCamera(camera, bounds);
  const position = project(camera, tileWidth);
  const target=unproject({x:position.x+direction.x/length*pixels,y:position.y+direction.y/length*pixels},tileWidth);
  const delta={x:target.x-camera.x,y:target.y-camera.y};let fraction=1;
  for(const [axis,limit] of [['x',bounds.width-1],['y',bounds.height-1]]) {
    if(delta[axis]>0)fraction=Math.min(fraction,(limit-camera[axis])/delta[axis]);
    else if(delta[axis]<0)fraction=Math.min(fraction,-camera[axis]/delta[axis]);
  }
  fraction=Math.max(0,Math.min(1,fraction));
  return clampCamera({x:camera.x+delta.x*fraction,y:camera.y+delta.y*fraction},bounds);
}
export function canMoveCamera(camera, bounds, direction, tileWidth = 144) {
  const next = moveCamera(camera, direction, 1, bounds, tileWidth);
  return Math.abs(next.x - camera.x) + Math.abs(next.y - camera.y) > 1e-8;
}
export function tileAtScreen(screen, camera, frame, tileWidth = 144) {
  const origin = project(camera, tileWidth);
  const point = unproject({ x: screen.x - cameraAnchor(frame).x + origin.x, y: screen.y - cameraAnchor(frame).y + origin.y }, tileWidth);
  return { x: Math.floor(point.x + .5), y: Math.floor(point.y + .5) };
}
export function visibleRegion(camera, frame, bounds, tileWidth = 144) {
  const origin = project(camera, tileWidth), padding = 170;
  const points = [[-padding,-padding],[frame.width+padding,-padding],[-padding,frame.height+padding],[frame.width+padding,frame.height+padding]].map(([x,y]) => unproject({x:x-cameraAnchor(frame).x+origin.x,y:y-cameraAnchor(frame).y+origin.y},tileWidth));
  return { x: Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-.5)), y: Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-.5)),
    right: Math.min(bounds.width-1,Math.ceil(Math.max(...points.map(p=>p.x))+.5)), bottom: Math.min(bounds.height-1,Math.ceil(Math.max(...points.map(p=>p.y))+.5)) };
}
export function missingChunks(camera, frame, bounds, terrain, tileWidth = 144) {
  const region=visibleRegion(camera,frame,bounds,tileWidth), chunks=[];
  for(let y=Math.floor(region.y/12)*12;y<=region.bottom;y+=12)for(let x=Math.floor(region.x/12)*12;x<=region.right;x+=12){
    const viewport={x,y,width:Math.min(12,bounds.width-x),height:Math.min(12,bounds.height-y)};
    let missing=false;
    for(let row=y;row<y+viewport.height&&!missing;row++)for(let col=x;col<x+viewport.width;col++)if(!terrain.has(`${col}:${row}`)){missing=true;break;}
    if(missing)chunks.push(viewport);
  }
  return chunks.sort((a,b)=>Math.hypot(a.x+a.width/2-camera.x,a.y+a.height/2-camera.y)-Math.hypot(b.x+b.width/2-camera.x,b.y+b.height/2-camera.y));
}
export function mergeMapCache(cache, snapshot) {
  if (!snapshot?.viewport || (cache.revision != null && snapshot.revision < cache.revision)) return cache;
  const reset=cache.revision != null && snapshot.revision>cache.revision;
  const terrain=new Map(reset?[]:cache.terrain),entities=new Map(reset?[]:cache.entities),v=snapshot.viewport;
  for(const item of snapshot.terrain??[])terrain.set(`${item.x}:${item.y}`,item);
  for(const [key,e]of entities)if(e.x>=v.x&&e.x<v.x+v.width&&e.y>=v.y&&e.y<v.y+v.height)entities.delete(key);
  for(const item of snapshot.entities??[])entities.set(`${item.x}:${item.y}`,item);
  return {revision:snapshot.revision,terrain,entities};
}

// Wall-clock integration, independent of frame/key repeat frequency. A press moves once;
// after the hold threshold only elapsed active milliseconds contribute to travel.
export function createCompassMotion(onMove) {
  let active=null;
  return {
    start(direction, now) { active={direction,startedAt:now,lastAt:now};onMove(direction,CAMERA_STEP_PX); },
    tick(now) { if(!active)return;const time=Math.max(active.lastAt,now),elapsed=Math.max(0,time-active.startedAt-HOLD_DELAY_MS)-Math.max(0,active.lastAt-active.startedAt-HOLD_DELAY_MS);active.lastAt=time;if(elapsed)onMove(active.direction,elapsed*CAMERA_SPEED_PX/1000); },
    stop() {active=null;},
    get active(){return active!==null;},
  };
}
