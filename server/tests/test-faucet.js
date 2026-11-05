// Faucet rule: the faucet keeps working for the WHOLE round, including while the arena shrinks, in all 3 arenas (sink, toilet, bathtub). Runs a full 3-round match (each arena is played once).
// The jet is switched off (GA=0) so the idle test soaps are not pushed out and every round runs to its time-out; only the faucet schedule is checked.
// Case 1 (GFIRST=1, FAST=5): warn at 1.0s, gush from 2.2s -> runs to 3.7s. Shrink starts at 3.0s, so this gush must NOT be cut off; the next warning (7.7s) comes after the shrink.
// Case 2 (GFIRST=4, FAST=5): first warning is scheduled AFTER the shrink began (3.0s) -> it must still fire (it never did before).
// Case 3 (default timing, FAST=2): first warning at 4s, then one every ~6.7s (1.2 warn + 1.5 gush + 4 gap) -> at least 3 warnings per round, several of them during the shrink.
const {spawn}=require('child_process'),WS=require('ws');
const FAST=5,sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c){bad=1;process.exitCode=1}};
async function run(port,gfirst,fast){
  const ROUND=45/fast;
  const sv=spawn('node',['server.js'],{env:{...process.env,PORT:port,FAST:fast,GFIRST:gfirst,GA:0},stdio:'ignore'});
  try{
    await sleep(800);
    const mk=()=>{const c={room:null,you:null,snaps:[]};c.ws=new WS('ws://localhost:'+port);
      c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='you')c.you=m;if(m.t==='s')c.snaps.push(m)});
      c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c};
    const A=mk(),B=mk();await Promise.all([A.open,B.open]);
    A.send({t:'create',name:'A'});while(!A.you)await sleep(50);
    B.send({t:'join',code:A.you.code,name:'B'});while(!(A.room&&A.room.players.length===2))await sleep(50);
    // both soaps hold the centre of the arena (the shrinking water would otherwise drop idle soaps spawned near the edge and end the round early)
    const hold=setInterval(()=>{for(const c of [A,B]){const s=c.snaps[c.snaps.length-1],e=s&&c.you&&s.p.find(p=>p[0]===c.you.id);if(!e||s.st!=='play')continue;const l=Math.hypot(e[1],e[2]);c.send({t:'in',x:l>25?-e[1]/l:0,y:l>25?-e[2]/l:0})}},50);
    A.send({t:'start'});const t0=Date.now();
    while(!(A.room&&A.room.st==='final')){if(Date.now()-t0>120000)throw new Error('match timeout');await sleep(100)}
    clearInterval(hold);
    const play=A.snaps.filter(s=>s.st==='play');
    const evs=[];for(const s of A.snaps)for(const e of s.ev)evs.push({e:e[0],a:s.a,t:ROUND-s.tm});
    return{play,evs};
  }finally{sv.kill()}
}
(async()=>{
  const ROUND=45/FAST,SHRINK_AT=15/FAST;
  const [r1,r2,r3]=await Promise.all([run(3121,1,FAST),run(3122,4,FAST),run(3123,'',2)]);
  const AS=[0,1,2];
  ok(AS.every(a=>r1.play.some(s=>s.a===a)&&r2.play.some(s=>s.a===a)),'all 3 arenas (sink, toilet, bathtub) were played in both matches');
  const f1=r1.evs.filter(x=>x.e==='warn'||x.e==='gush');
  for(const a of AS){
    ok(f1.some(x=>x.e==='warn'&&x.a===a&&x.t<SHRINK_AT),'GFIRST=1: faucet warns in arena '+a);
    ok(f1.some(x=>x.e==='gush'&&x.a===a&&x.t<SHRINK_AT+0.2),'GFIRST=1: faucet gushes in arena '+a);
    ok(f1.some(x=>x.e==='warn'&&x.a===a&&x.t>=SHRINK_AT),'GFIRST=1: faucet warns AGAIN after the shrink began in arena '+a);
  }
  // the gush that started before the shrink (2.2s-3.7s) keeps going after the shrink began (3.0s)
  const cross=r1.play.filter(s=>ROUND-s.tm>=SHRINK_AT+0.2&&s.g&&s.g[1]===1);
  ok(cross.length>0,'GFIRST=1: a gush in progress when the shrink begins is NOT cut off ('+cross.length+' snapshots with gush after shrink start)');
  // GFIRST=4 is after the shrink start: the faucet must still fire, in every arena, while the water is smaller
  const f2=r2.evs.filter(x=>x.e==='warn'||x.e==='gush');
  for(const a of AS){
    ok(f2.some(x=>x.e==='warn'&&x.a===a&&x.t>=SHRINK_AT),'GFIRST=4: faucet warns after the shrink began in arena '+a);
    ok(f2.some(x=>x.e==='gush'&&x.a===a&&x.t>=SHRINK_AT),'GFIRST=4: faucet gushes after the shrink began in arena '+a);
  }
  ok(r2.play.some(s=>s.g&&s.R<299),'GFIRST=4: stripe/gush (snapshot g) is present while the arena is shrinking (R<300)');
  // Case 3: default timing, whole round
  const R3=45/2,S3=15/2,w3=r3.evs.filter(x=>x.e==='warn');
  for(const a of AS){
    const w=w3.filter(x=>x.a===a).map(x=>x.t);
    ok(w.length>=3,'default timing: at least 3 warnings in one round of arena '+a+' ('+w.map(v=>v.toFixed(1)).join(', ')+')');
    ok(w.filter(v=>v>=S3).length>=2,'default timing: at least 2 of them while the arena shrinks, arena '+a);
    ok(w.length>1&&w.slice(1).every((v,i)=>v-w[i]<8),'default timing: gap between warnings is under 8s, arena '+a);
    ok(Math.abs(w[0]-4)<0.3,'default timing: first warning at ~4s, arena '+a+' ('+(w[0]||0).toFixed(1)+')');
  }
  // snake faucet: every stripe snapshot names a rim port (0-3) and the jet points into the arena from that port
  const PORTS=[-Math.PI/2,0,Math.PI/2,Math.PI];
  for(const [n,r] of [['GFIRST=1',r1],['GFIRST=4',r2],['default',r3]])for(const a of AS){
    const stripes=r.play.filter(s=>s.a===a&&s.g);
    ok(stripes.length>0&&stripes.every(s=>s.g.length===4&&[0,1,2,3].includes(s.g[3])),n+', arena '+a+': snapshot g carries the port index');
    ok(stripes.every(s=>{const p=PORTS[s.g[3]],inw=[-Math.cos(p),-Math.sin(p)];return Math.cos(s.g[0])*inw[0]+Math.sin(s.g[0])*inw[1]>0.3}),n+', arena '+a+': the jet always points into the arena (inward within ~63 degrees)');
  }
  console.log(bad?'FAUCET TESTS FAILED':'FAUCET TESTS PASSED');process.exit(bad)
})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});
