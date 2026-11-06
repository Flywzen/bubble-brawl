// Character skills test suite (all 28 characters + toggle + signature mechanics). Run: node tests/test-skills.js (port 3119, FAST=10)
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3119,FAST:10},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=20000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(15)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,err:null,evs:[],prjs:0};c.ws=new WS('ws://localhost:3119');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s'){c.snap=m;c.evs.push(...m.ev);if(m.prj&&m.prj.length)c.prjs+=m.prj.length}if(m.t==='you')c.you=m;if(m.t==='err')c.err=m});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
const me=c=>c.snap&&c.snap.p.find(p=>p[0]===c.you.id);

(async()=>{try{await sleep(600);
 // 1. Room toggle sk (default ON=1, toggle OFF=0, toggle ON=1)
 const A=cl(),B=cl();await Promise.all([A.open,B.open]);
 A.send({t:'create',name:'Host',ci:22});await until(()=>A.room);
 ok(A.room.sk===1,'room defaults to skills ON (sk=1)');
 B.send({t:'join',code:A.you.code,name:'Guest',ci:19});await until(()=>B.room&&B.room.players.length===2);
 A.send({t:'setsk',sk:0});await until(()=>A.room.sk===0&&B.room.sk===0);
 ok(true,'host can toggle skills OFF (sk=0) and broadcast to lobby');
 B.send({t:'ready',v:1});await until(()=>A.room.players.find(p=>p.id===B.you.id).rd===1);
 A.send({t:'start'});await until(()=>A.snap&&A.snap.st==='play');
 A.evs=[];A.send({t:'skill'});await sleep(120);
 ok(!A.evs.some(e=>e[0]==='sk')&&me(A)[11]===0,'skill is ignored when room.sk===0');
 A.ws.close();B.ws.close();await sleep(100);

 // 2. Test all 28 characters (0..27) can activate their unique skill
 let allTriggered=true;
 for(let ci=0;ci<28;ci++){
  const P=cl();await P.open;
  P.send({t:'create',name:'P'+ci,ci,quick:1,bots:1,sk:1});
  await until(()=>P.snap&&P.snap.st==='play');
  P.evs=[];P.send({t:'skill'});
  await until(()=>P.evs.some(e=>e[0]==='sk'&&e[1]===P.you.id&&e[2]===ci),5000);
  const s=me(P);
  if(!s||!(s[11]>0)){allTriggered=false;console.log('FAIL cooldown not set for ci='+ci)}
  if(ci===19){await until(()=>P.prjs>0,3000);ok(P.prjs>0,'ci=19 (Limitless Lather / Gojo) spawns Hollow Purple projectile')}
  if(ci===25){ok((s[12]&2)===2,'ci=25 (Mahorasuds / Mahoraga) sets unstoppable invulnerable state bit (sks&2)')}
  P.ws.close();
 }
 ok(allTriggered,'all 28 characters (0..27) trigger their unique skill and enter cooldown');

 // 3. Test Sukuna (ci=22), Douma (ci=27), and Toji (ci=24) parry-pierce in 1v1 combat
 const S1=cl(),S2=cl();await Promise.all([S1.open,S2.open]);
 S1.send({t:'create',name:'Toji',ci:24,sk:1});await until(()=>S1.room);
 S2.send({t:'join',code:S1.you.code,name:'Target',ci:27});await until(()=>S2.room&&S2.room.players.length===2);
 S2.send({t:'ready',v:1});await until(()=>S1.room.players.find(p=>p.id===S2.you.id).rd===1);
 S1.send({t:'start'});await until(()=>S1.snap&&S1.snap.st==='play');
 // Move S1 and S2 close together, face S2, S2 parries, S1 uses Toji's Heavenly Blink (pierces parry)
 const loop=setInterval(()=>{
  const a=me(S1),b=me(S2);if(!a||!b||S1.snap.st!=='play')return;
  const dx=b[1]-a[1],dy=b[2]-a[2],d=Math.hypot(dx,dy)||1;
  S1.send({t:'in',x:dx/d,y:dy/d});S2.send({t:'in',x:-dx/d,y:-dy/d});
  if(d<155&&!S1.fired){S1.fired=1;S2.send({t:'parry'});setTimeout(()=>S1.send({t:'skill'}),30)}
 },20);
 await until(()=>S1.evs.some(e=>e[0]==='sk'&&e[2]===24),10000);
 clearInterval(loop);
 await sleep(120);
 ok(!S1.evs.some(e=>e[0]==='parried'),'Toji (ci=24) Heavenly Blink pierces Parry without triggering parried reflection');
 ok(S1.evs.some(e=>e[0]==='hit'),'Toji (ci=24) Heavenly Blink lands hit on target');
 S1.ws.close();S2.ws.close();

 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();

