import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLIANCE_RULES as rules, emptyAlliances, applyAlliance, allianceQuote, membership, validateAlliances, allianceSummary, alliancePublic, allianceText, alliancePage } from '../packages/game-core/alliances.js';
import { parseConfiguration } from '../apps/server/config.js';
const actor = id => ({id,name:id,deliveredSequence:99999});
function fixture(maxMembers=3) {
  let sequence=0, now=100000000; const uuid=()=>`id-${++sequence}`;
  const world={instanceId:'instance',map:{revision:1,entities:[]},alliances:emptyAlliances()}, config={...rules,maxMembers};
  const run=(id,type,p={})=>applyAlliance(world,actor(id),`alliance.${type}`,p,now,config,uuid);
  const create=(id,name=id,tag=id)=>run(id,'create',{name,tag,rulesVersion:config.version});
  const ctx=id=>{const {alliance:a,member:m}=membership(world,id);return {allianceId:a.id,membershipId:m.membershipId,adminVersion:a.adminVersion};};
  const invite=(from,to)=>{run(from,'invite',{...ctx(from),recipientId:to,recipientName:to});return membership(world,from).alliance.invitations.at(-1);};
  const join=(from,to)=>{const i=invite(from,to);run(to,'invitation.respond',{invitationId:i.id,response:'accept'});};
  return {world,run,ctx,create,invite,join,setNow:n=>now=n,now:()=>now};
}
test('Gründung: Normalisierung, eindeutige Namen/Kürzel, Cooldown und strikte ENV',()=>{
  const f=fixture();f.create('AAA','  Ａlpha  ','aa'); const a=membership(f.world,'AAA').alliance;
  assert.equal(a.name,'Alpha');assert.equal(a.tag,'AA');
  assert.throws(()=>f.create('BBB','ALPHA','bb'),/vergeben/);assert.throws(()=>f.create('BBB','Beta','aa'),/vergeben/);
  f.run('AAA','dissolve',f.ctx('AAA'));assert.throws(()=>f.create('AAA','Gamma','gg'),/24 Stunden/);
  f.create('BBB','Alpha','aa');assert.notEqual(membership(f.world,'BBB').alliance.id,a.id);
  for(const [key,values] of Object.entries({ALLIANCE_CREATE_WOOD:['-1','1.5','1000001',''],ALLIANCE_MAX_MEMBERS:['1','101'],ALLIANCE_INVITE_TTL_HOURS:['0','8761']})) for(const value of values) assert.throws(()=>parseConfiguration({[key]:value}),new RegExp(key));
  assert.equal(parseConfiguration({ALLIANCE_CREATE_WOOD:'0'}).alliances.wood,0);
});
test('Einladungen: Duplikate ohne Fristverlängerung, fremde Annahme, voller letzter Platz und Ablauf exakt',()=>{
  const f=fixture(2);f.create('AAA');const i=f.invite('AAA','BBB');f.setNow(f.now()+1000);f.invite('AAA','BBB');assert.equal(membership(f.world,'AAA').alliance.invitations.length,1);
  assert.throws(()=>f.run('CCC','invitation.respond',{invitationId:i.id,response:'accept'}),/ungültig/);
  const second=f.invite('AAA','CCC');f.run('BBB','invitation.respond',{invitationId:i.id,response:'accept'});
  assert.throws(()=>f.run('CCC','invitation.respond',{invitationId:second.id,response:'accept'}),/voll/);assert.equal(second.status,'open');
  f.setNow(second.expiresAt);assert.throws(()=>f.run('CCC','invitation.respond',{invitationId:second.id,response:'accept'}),/abgelaufen/);
});
test('Nur eine Mitgliedschaft, andere Einladungen ungültig, fünf Städte bleiben ein Platz',()=>{
  const f=fixture();f.create('AAA');f.create('BBB');const one=f.invite('AAA','CCC'),two=f.invite('BBB','CCC');
  f.run('CCC','invitation.respond',{invitationId:one.id,response:'accept'});assert.equal(two.status,'invalid');assert.throws(()=>f.run('CCC','invitation.respond',{invitationId:two.id,response:'accept'}));
  f.world.map.entities=Array.from({length:5},(_,i)=>({kind:'player',playerId:'CCC',id:`city${i}`}));assert.equal(alliancePublic(f.world,membership(f.world,'AAA').alliance).memberCount,2);assert.equal(alliancePublic(f.world,membership(f.world,'AAA').alliance).members[1].cities.length,5);
});
test('Rechte: Offizier, veraltete Tabs, Übergabe, Austritt, Wiedereintritt und Auflösung',()=>{
  const f=fixture(5);f.create('AAA');f.join('AAA','BBB');f.join('AAA','CCC');
  const target=id=>({targetMembershipId:f.ctx(id).membershipId});
  assert.throws(()=>f.run('BBB','invite',{...f.ctx('BBB'),recipientId:'DDD'}),/Keine/);
  f.run('AAA','role.change',{...f.ctx('AAA'),...target('BBB'),role:'officer'});const old=f.ctx('BBB');
  assert.throws(()=>f.run('BBB','member.remove',{...f.ctx('BBB'),...target('AAA')}));
  assert.throws(()=>f.run('BBB','leadership.transfer',{...f.ctx('BBB'),...target('CCC')}),/Anführer/);
  f.run('AAA','role.change',{...f.ctx('AAA'),...target('BBB'),role:'member'});
  assert.throws(()=>f.run('BBB','invite',{...old,recipientId:'DDD'}),/geändert/);
  f.run('AAA','leadership.transfer',{...f.ctx('AAA'),...target('BBB')});assert.equal(membership(f.world,'AAA').member.role,'officer');assert.equal(membership(f.world,'BBB').member.role,'leader');
  assert.throws(()=>f.run('BBB','leave',f.ctx('BBB')));assert.throws(()=>f.run('BBB','dissolve',f.ctx('BBB')));
  const oldMembership=f.ctx('AAA');f.run('AAA','leave',f.ctx('AAA'));f.join('BBB','AAA');assert.notEqual(f.ctx('AAA').membershipId,oldMembership.membershipId);assert.throws(()=>f.run('AAA','chat.send',{...oldMembership,text:'stale'}),/mitgliedschaft/);
  f.run('BBB','member.remove',{...f.ctx('BBB'),...target('AAA')});f.run('CCC','leave',f.ctx('CCC'));f.run('BBB','dissolve',f.ctx('BBB'));assert.equal(f.world.alliances.items.length,0);
});
test('Chat: Sequenzen, getrennte Versionen, Rate, Retention, Moderation, Lesemarke und Textgrenzen',()=>{
  const f=fixture();f.create('AAA');f.join('AAA','BBB');const version=f.ctx('AAA').adminVersion;
  for(let i=0;i<205;i++){f.setNow(f.now()+60001);f.run('AAA','chat.send',{...f.ctx('AAA'),text:`<script>${i}</script>`});}
  const a=membership(f.world,'AAA').alliance;assert.equal(a.chat.length,200);assert.equal(a.chat[0].sequence,6);assert.equal(a.sequence,205);assert.equal(a.adminVersion,version);
  assert.throws(()=>f.run('BBB','chat.remove',{...f.ctx('BBB'),messageId:a.chat.at(-1).id}),/Moderationsrechte/);
  f.run('AAA','chat.remove',{...f.ctx('AAA'),messageId:a.chat.at(-1).id});assert.equal(a.chat.at(-1).text,undefined);assert.equal(a.sequence,205);
  f.run('BBB','chat.read',{...f.ctx('BBB'),sequence:205});f.run('BBB','chat.read',{...f.ctx('BBB'),sequence:6});assert.equal(membership(f.world,'BBB').member.lastReadSequence,205);
  assert.throws(()=>f.run('BBB','chat.read',{...f.ctx('BBB'),sequence:206}),/Lesemarke/);
  const noticeVersion=a.notice.version;f.run('AAA','notice.update',{...f.ctx('AAA'),noticeVersion,text:'notice'});assert.throws(()=>f.run('AAA','notice.update',{...f.ctx('AAA'),noticeVersion,text:'stale'}),/geändert/);
  f.setNow(f.now()+60001);for(let n=0;n<5;n++)f.run('BBB','chat.send',{...f.ctx('BBB'),text:'hi'});assert.throws(()=>f.run('BBB','chat.send',{...f.ctx('BBB'),text:'six'}),/limit/);
  assert.equal(allianceText('😀'.repeat(2000),1,2000,true).length,4000);assert.throws(()=>allianceText('😀'.repeat(2001),1,2000,true));assert.throws(()=>allianceText('bad\u0000',1,2000,true));
  const page=alliancePage(a.chat,null,'sequence');assert.ok(new TextEncoder().encode(JSON.stringify(page)).length<25000);assert.ok(page.nextCursor);
  assert.equal(alliancePublic(f.world,a).chat,undefined);
  const broken=structuredClone(f.world);broken.alliances.items[0].members[1].role='leader';assert.throws(()=>validateAlliances(broken));
});
test('Vollständige Rollenmatrix und aktuelle Berechtigungen statt Clientbehauptung',()=>{
  const cases=[
    ['invite','leader',true],['invite','officer',true],['invite','member',false],
    ['invitation.revoke','leader',true],['invitation.revoke','officer',true],['invitation.revoke','member',false],
    ['description.update','leader',true],['description.update','officer',true],['description.update','member',false],
    ['notice.update','leader',true],['notice.update','officer',true],['notice.update','member',false],
    ['role.change','leader',true],['role.change','officer',false],['role.change','member',false],
    ['leadership.transfer','leader',true],['leadership.transfer','officer',false],['leadership.transfer','member',false],
    ['member.remove','leader',true],['member.remove','officer',true],['member.remove','member',false],
    ['chat.send','leader',true],['chat.send','officer',true],['chat.send','member',true],
    ['chat.remove','leader',true],['chat.remove','officer',true],['chat.remove','member',false],
  ];
  for(const [type,role,allowed] of cases){
    const f=fixture(5);f.create('AAA');f.join('AAA','BBB');f.join('AAA','CCC');
    f.run('AAA','role.change',{...f.ctx('AAA'),targetMembershipId:f.ctx('BBB').membershipId,role:'officer'});
    const invitation=f.invite('AAA','DDD');f.run('AAA','chat.send',{...f.ctx('AAA'),text:'leader post'});
    const id=role==='leader'?'AAA':role==='officer'?'BBB':'CCC';
    const p={...f.ctx(id),recipientId:'EEE',recipientName:'EEE',targetMembershipId:f.ctx('CCC').membershipId,text:'text',noticeVersion:0,role:'officer',invitationId:invitation.id,messageId:membership(f.world,'AAA').alliance.chat[0].id};
    // For a member actor choose the officer as target so self-exclusion is never confused with authority.
    if(id==='CCC')p.targetMembershipId=f.ctx('BBB').membershipId;
    const run=()=>f.run(id,type,p);
    if(allowed)assert.doesNotThrow(run,`${role} ${type}`);else assert.throws(run,`${role} ${type}`);
  }
});
test('Einladungen bleiben nach Aussteller-Rollenwechsel gültig, Limits und TTL sind gespeichert',()=>{
  const f=fixture(100);f.create('AAA');f.join('AAA','BBB');f.run('AAA','role.change',{...f.ctx('AAA'),targetMembershipId:f.ctx('BBB').membershipId,role:'officer'});
  const i=f.invite('BBB','CCC');f.run('AAA','role.change',{...f.ctx('AAA'),targetMembershipId:f.ctx('BBB').membershipId,role:'member'});f.run('CCC','invitation.respond',{invitationId:i.id,response:'accept'});assert.ok(membership(f.world,'CCC'));
  const start=f.now();for(let n=0;n<9;n++)f.invite('AAA',`target-${n}`);assert.throws(()=>f.invite('AAA','overflow'),/limit/);f.setNow(start+3600000);f.invite('AAA','after-hour');
  assert.equal(membership(f.world,'AAA').alliance.maxMembers,100);
});
test('Offiziere schließen keine anderen Offiziere aus; offene Einladungsgrenzen und UTF-8-Seiten',()=>{
  const f=fixture(100);f.create('AAA');f.join('AAA','BBB');f.join('AAA','CCC');
  for(const id of ['BBB','CCC'])f.run('AAA','role.change',{...f.ctx('AAA'),targetMembershipId:f.ctx(id).membershipId,role:'officer'});
  assert.throws(()=>f.run('BBB','member.remove',{...f.ctx('BBB'),targetMembershipId:f.ctx('CCC').membershipId}),/Ausschlussrechte/);
  const many=fixture(100);many.create('AAA');for(let n=0;n<20;n++){if(n%10===0)many.setNow(many.now()+3600001);many.invite('AAA',`R${n}`);}many.setNow(many.now()+3600001);assert.throws(()=>many.invite('AAA','over-limit'),/offene Einladungen/);
  const recipient=fixture(100);for(let n=0;n<10;n++){const id=`L${String(n).padStart(2,'0')}`;recipient.create(id);recipient.invite(id,'Target');}recipient.create('L10');assert.throws(()=>recipient.invite('L10','Target'),/offene Einladungen/);
  const page=alliancePage(Array.from({length:100},(_,i)=>({id:String(i),text:'😀'.repeat(2000)})));assert.equal(page.items.length,1);assert.ok(new TextEncoder().encode(JSON.stringify(page)).length<16384);
});
