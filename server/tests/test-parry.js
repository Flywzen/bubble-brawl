// Parry + soap selection tests. Run: node test-parry.js (own server on port 3114, FAST=10)
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3114,FAST:10},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=30000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(20)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,err:null,evs:[]};c.ws=new WS('ws://localhost:3114');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s'){c.snap=m;c.evs.push(...m.ev)}if(m.t==='you')c.you=m;if(m.t==='err'){c.err=m}});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
const me=c=>c.snap&&c.snap.p.find(p=>p[0]===c.you.id);
(async()=>{try{await sleep(800);
 // ---- soap selection ----
 const A=cl(),B=cl(),C=cl();await Promise.all([A.open,B.open,C.open]);
 A.send({t:'create',name:'Ani',ci:5});await until(()=>A.room);
 ok(A.room.players[0].ci===5,'creator gets the soap they picked (5)');
 const code=A.you.code;
 B.send({t:'join',code,name:'Budi',ci:5});await until(()=>B.room&&B.room.players.length===2);
 ok(B.room.players.find(p=>p.id===B.you.id).ci!==5,'picking a soap that is taken falls back to a free one');
 B.send({t:'soap',ci:5});await until(()=>B.err);ok(/taken/i.test(B.err.m),'changing to another human\'s soap is refused');
 B.send({t:'soap',ci:7});await until(()=>B.room.players.find(p=>p.id===B.you.id).ci===7);ok(true,'changing to a free soap works and reaches everyone');
 ok(A.room.players.find(p=>p.id===B.you.id).ci===7,'other clients see the new soap');
 B.send({t:'soap',ci:12});await until(()=>B.room.players.find(p=>p.id===B.you.id).ci===12);ok(true,'new soaps (8-17) can be picked, e.g. 12');
  B.send({t:'soap',ci:17});await until(()=>B.room.players.find(p=>p.id===B.you.id).ci===17);ok(true,'the newest soap (17) can be picked');B.send({t:'soap',ci:12});await until(()=>B.room.players.find(p=>p.id===B.you.id).ci===12);B.send({t:'soap',ci:18});await sleep(200);ok(B.room.players.find(p=>p.id===B.you.id).ci===12,'soap index 18 is out of range and ignored');
  B.send({t:'soap',ci:7});await until(()=>B.room.players.find(p=>p.id===B.you.id).ci===7);
  A.send({t:'addbot'});await until(()=>A.room.players.length===3);const bot=A.room.players.find(p=>p.bot);
 A.send({t:'soap',ci:bot.ci});await until(()=>A.room.players.find(p=>p.id===A.you.id).ci===bot.ci);
 ok(A.room.players.find(p=>p.id===bot.id).ci===5,'taking a bot\'s soap swaps the looks (bot gets mine)');
 // soap choice survives a rematch / start
 // ---- parry: A rushes B (dash), B parries -> A is thrown back and stunned, B is not pushed ----
 A.send({t:'rmbot'});await until(()=>A.room.players.length===2);
 A.send({t:'start'});await until(()=>A.snap&&A.snap.st==='play',20000);
 let done=false,res=null;
 const run=setInterval(()=>{const a=me(A),b=me(B);if(!a||!b||A.snap.st!=='play')return;
  const dx=b[1]-a[1],dy=b[2]-a[2],d=Math.hypot(dx,dy);
  A.send({t:'in',x:dx/d,y:dy/d});
  if(d<260&&!A.dashed){A.dashed=1;A.send({t:'dash'})}
  if(d<150&&!B.pd){B.pd=1;B.t0=Date.now();B.send({t:'parry'})}
 },20);
 await until(()=>A.evs.some(e=>e[0]==='parried'),15000);clearInterval(run);
 const ev=A.evs.find(e=>e[0]==='parried');
 ok(ev[1]===B.you.id&&ev[2]===A.you.id,'parried event: parrier B, attacker A');
 await sleep(150);const a2=me(A),b2=me(B);
 ok(a2[7]!==undefined&&a2[10]===1,'attacker is flagged stunned in the snapshot');
 const bspeed=Math.hypot(b2[3],b2[4]),aspeed=Math.hypot(a2[3],a2[4]);
 ok(aspeed>250&&aspeed>bspeed*2,'attacker is thrown back hard ('+Math.round(aspeed)+' px/s) while the parrier barely moves ('+Math.round(bspeed)+')');
 ok(me(B)[8]>1&&me(B)[8]<=2,'successful parry: short cooldown (~2s), got '+me(B)[8]);
 ok(!A.evs.some(e=>e[0]==='hit'&&e[3]>60&&Date.now()-B.t0<400),'no ordinary hit event for a parried ram');
 // ---- a parry that catches nothing: long cooldown, shield flag lasts only ~0.3s ----
 await until(()=>A.snap.st!=='play'||(me(B)&&me(B)[8]<=0.05),20000).catch(()=>{});
 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();
