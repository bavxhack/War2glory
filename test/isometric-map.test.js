import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraAnchor,project,unproject,clampCamera,moveCamera,canMoveCamera,tileAtScreen,mergeMapCache,missingChunks,createCompassMotion,CAMERA_STEP_PX,CAMERA_SPEED_PX,HOLD_DELAY_MS} from '../apps/client/isometric-map.js';
import {MAP_DIRECTIONS} from '../apps/client/map-navigation.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('isometric projection and picking agree at all corners and camera/scale settings',()=>{
 for(const width of [112,128,144,208])for(const point of [{x:0,y:0},{x:23,y:0},{x:0,y:23},{x:23,y:23},{x:12,y:7}]){
  const p=project(point,width),back=unproject(p,width);close(back.x,point.x);close(back.y,point.y);
  for(const camera of [{x:12.5,y:11.2},{x:0,y:0},{x:23,y:23}]){
   const frame={width:390,height:510},origin=project(camera,width),anchor=cameraAnchor(frame);
   assert.deepEqual(tileAtScreen({x:p.x-origin.x+anchor.x,y:p.y-origin.y+anchor.y},camera,frame,width),point);
   assert.deepEqual(tileAtScreen({x:p.x-origin.x+anchor.x+width*.08,y:p.y-origin.y+anchor.y+width*.025},camera,frame,width),point);
  }
 }
});

test('eight compass directions follow the screen, keep scale and stop instead of sliding at world bounds',()=>{
 const bounds={width:24,height:24},camera={x:12,y:12};
 for(const d of MAP_DIRECTIONS){const before=project(camera),next=moveCamera(camera,d,64,bounds),after=project(next),n=Math.hypot(d.x,d.y);close(after.x-before.x,d.x/n*64);close(after.y-before.y,d.y/n*64);}
 assert.deepEqual(clampCamera({x:-5,y:90},bounds),{x:0,y:23});
 assert.deepEqual(moveCamera({x:0,y:8},{x:0,y:-1},100,bounds),{x:0,y:8});
 assert.equal(canMoveCamera({x:0,y:8},bounds,{x:0,y:-1}),false);
 for(const d of MAP_DIRECTIONS){const next=moveCamera(camera,d,100000,bounds);assert.ok(next.x>=0&&next.x<=23&&next.y>=0&&next.y<=23);}
 for(const d of MAP_DIRECTIONS)assert.equal(canMoveCamera({x:0,y:0},{width:1,height:1},d),false);
});

test('hold travel uses elapsed wall time, not animation frame or keyboard repeat count',()=>{
 function distance(times){let pixels=0;const motion=createCompassMotion((_,value)=>pixels+=value);motion.start({x:1,y:0},0);for(const time of times)motion.tick(time);motion.stop();motion.tick(999999);return pixels;}
 const small=Array.from({length:101},(_,i)=>i*10);
 close(distance(small),distance([1000]));close(distance([1000]),CAMERA_STEP_PX+(1000-HOLD_DELAY_MS)*CAMERA_SPEED_PX/1000);
 close(distance([100]),CAMERA_STEP_PX);
});

test('release/cancel stops immediately and changing directions cannot leave an old movement active',()=>{
 const moves=[];const motion=createCompassMotion((d,p)=>moves.push({d,p}));
 motion.start({x:1,y:0},0);motion.tick(500);motion.stop();const n=moves.length;motion.tick(1000);assert.equal(moves.length,n);assert.equal(motion.active,false);
 motion.start({x:0,y:-1},1100);motion.tick(1500);assert.deepEqual(moves.at(-1).d,{x:0,y:-1});motion.stop();motion.stop();assert.equal(motion.active,false);
});

test('public tile cache merges viewports, ignores late revisions and expires changed entities',()=>{
 const empty={revision:null,terrain:new Map(),entities:new Map()},first={revision:4,viewport:{x:0,y:0,width:1,height:1},terrain:[{x:0,y:0,type:'plains'}],entities:[{id:'a',x:0,y:0,type:'npc'}]};
 const a=mergeMapCache(empty,first),b=mergeMapCache(a,{...first,viewport:{x:1,y:0,width:1,height:1},terrain:[{x:1,y:0,type:'water'}],entities:[]});
 assert.equal(b.terrain.size,2);assert.equal(b.entities.get('0:0').id,'a');assert.equal(mergeMapCache(b,{...first,revision:3}),b);
 const c=mergeMapCache(b,{...first,entities:[]});assert.equal(c.entities.has('0:0'),false);
 const d=mergeMapCache(c,{...first,revision:5});assert.equal(d.terrain.size,1);assert.equal(d.entities.size,1);
});

test('map requests are bounded to existing world tiles and server viewport limits; cached regions need no reload',()=>{
 const bounds={width:24,height:24},terrain=new Map();
 for(const camera of [{x:0,y:0},{x:23,y:23},{x:23,y:0},{x:0,y:23}])for(const chunk of missingChunks(camera,{width:850,height:500},bounds,terrain)){
  assert.ok(chunk.x>=0&&chunk.y>=0&&chunk.width<=15&&chunk.height<=15&&chunk.x+chunk.width<=24&&chunk.y+chunk.height<=24);
 }
 for(let y=0;y<24;y++)for(let x=0;x<24;x++)terrain.set(`${x}:${y}`,{});
 assert.deepEqual(missingChunks({x:12,y:12},{width:850,height:500},bounds,terrain),[]);
 assert.deepEqual(missingChunks({x:0,y:0},{width:850,height:500},{width:2,height:3},new Map()),[{x:0,y:0,width:2,height:3}]);
});
