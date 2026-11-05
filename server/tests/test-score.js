// Scoring test: round win points + kill points. Run: node test-score.js (own server on port 3115, FAST=4, faucet switched off)
// A rams B (idle) with dashes; B falls out -> A is credited with the kill (+1) on top of the round win (+3).
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3115,FAST:4,GFIRST:99999},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=90000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(30)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,evs:[]};c.ws=new WS('ws://localhost:3115');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s'){c.snap=m;c.evs.push(...m.ev)}if(m.t==='you')c.you=m});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
(async()=>{try{await sleep(800);
 const A=cl(),B=cl();await Promise.all([A.open,B.open]);
 A.send({t:'create',name:'Ani'});await until(()=>A.you);
 B.send({t:'join',code:A.you.code,name:'Budi'});await until(()=>B.you&&A.room.players.length===2);
 const hunt=setInterval(()=>{const s=A.snap;if(!s||s.st!=='play')return;const a=s.p.find(p=>p[0]===A.you.id),b=s.p.find(p=>p[0]===B.you.id);if(!a||!b||!a[5]||!b[5])return;
   const dx=b[1]-a[1],dy=b[2]-a[2],d=Math.hypot(dx,dy)||1;A.send({t:'in',x:dx/d,y:dy/d});if(a[6]<=0&&d<260)A.send({t:'dash'})},40);
 B.send({t:'ready',v:1});await until(()=>(B.you&&A.room.players.find(p=>p.id===B.you.id)||{}).rd===1);A.send({t:'start'});await until(()=>A.room.st==='final');clearInterval(hunt);
 const id=A.you.id,bid=B.you.id,log=A.room.log,pa=A.room.players.find(p=>p.id===id),pb=A.room.players.find(p=>p.id===bid);
 const kills=log.reduce((n,l)=>n+((l.k&&l.k[id])||0),0), expect=log.reduce((n,l)=>n+((l.pts&&l.pts[id])||0)+((l.k&&l.k[id])||0),0);
 console.log('INFO log:',JSON.stringify(log));
 ok(log.length===3,'3 rounds were played');
 ok(kills>=1,'A made at least one kill by ramming B ('+kills+')');
 ok(pa.score===expect,'A score = round points + kill points ('+pa.score+' = '+expect+')');
 ok(pa.kl===kills,'player info carries the total kills ('+pa.kl+')');
 ok(log.every(l=>!(l.k&&l.k[bid])),'B (idle) never gets a kill');
 ok(log.some(l=>l.w===id&&l.k&&l.k[id]===1&&true),'a round won by knocking the last rival out is worth win + kill');
 const outs=A.evs.filter(e=>e[0]==='out'&&e[1]===bid);
 ok(outs.filter(e=>e[4]===id).length===kills,'every kill shows up as an out event carrying the killer id ('+outs.length+' outs of B)');
 ok(pb.score===log.reduce((n,l)=>n+((l.pts&&l.pts[bid])||0),0),'B only has round points (no kills)');
 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();
