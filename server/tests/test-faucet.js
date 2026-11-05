// Faucet rule: gushes only happen BEFORE the arena starts shrinking, in all 3 arenas (sink, toilet, bathtub). Runs a full 3-round match (each arena is played once).
// Case 1 (GFIRST=1): warn at 1.0s, gush from 2.2s -> would run to 3.7s, but shrink starts at 3.0s (FAST=5) so it must be cut off.
// Case 2 (GFIRST=4): first warning is scheduled AFTER the shrink began -> must never fire.
const {spawn}=require('child_process'),WS=require('ws');
const FAST=5,ROUND=45/FAST,SHRINK_AT=15/FAST,sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c){bad=1;process.exitCode=1}};
async function run(port,gfirst){
  const sv=spawn('node',['server.js'],{env:{...process.env,PORT:port,FAST,GFIRST:gfirst},stdio:'ignore'});
  try{
    await sleep(800);
    const mk=()=>{const c={room:null,you:null,snaps:[]};c.ws=new WS('ws://localhost:'+port);
      c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='you')c.you=m;if(m.t==='s')c.snaps.push(m)});
      c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c};
    const A=mk(),B=mk();await Promise.all([A.open,B.open]);
    A.send({t:'create',name:'A'});while(!A.you)await sleep(50);
    B.send({t:'join',code:A.you.code,name:'B'});while(!(A.room&&A.room.players.length===2))await sleep(50);
    A.send({t:'start'});const t0=Date.now();
    while(!(A.room&&A.room.st==='final')){if(Date.now()-t0>120000)throw new Error('match timeout');await sleep(100)}
    const play=A.snaps.filter(s=>s.st==='play');
    const evs=[];for(const s of A.snaps)for(const e of s.ev)evs.push({e:e[0],a:s.a,t:ROUND-s.tm});
    return{play,evs};
  }finally{sv.kill()}
}
(async()=>{
  const [r1,r2]=await Promise.all([run(3121,1),run(3122,4)]);
  const AS=[0,1,2];
  ok(AS.every(a=>r1.play.some(s=>s.a===a)&&r2.play.some(s=>s.a===a)),'all 3 arenas (sink, toilet, bathtub) were played in both matches');
  const f1=r1.evs.filter(x=>x.e==='warn'||x.e==='gush');
  for(const a of AS){
    ok(f1.some(x=>x.e==='warn'&&x.a===a&&x.t<SHRINK_AT),'GFIRST=1: faucet warns before shrinking in arena '+a);
    ok(f1.some(x=>x.e==='gush'&&x.a===a&&x.t<SHRINK_AT+0.2),'GFIRST=1: faucet gushes before shrinking in arena '+a);
  }
  ok(f1.every(x=>x.t<SHRINK_AT+0.2),'GFIRST=1: no warn/gush after shrink start in any arena');
  const late=r1.play.filter(s=>ROUND-s.tm>=SHRINK_AT+0.2&&s.g);
  ok(late.length===0,'GFIRST=1: stripe/gush (snapshot g) is off in every snapshot after the shrink began (gush in progress at 3.0s was cut)');
  // snake faucet: every stripe snapshot names a rim port (0-3) and the jet points into the arena from that port
  const PORTS=[-Math.PI/2,0,Math.PI/2,Math.PI];
  for(const a of AS){
    const stripes=r1.play.filter(s=>s.a===a&&s.g);
    ok(stripes.length>0&&stripes.every(s=>s.g.length===4&&[0,1,2,3].includes(s.g[3])),'snake faucet, arena '+a+': snapshot g carries the port index');
    ok(stripes.every(s=>{const p=PORTS[s.g[3]],inw=[-Math.cos(p),-Math.sin(p)];return Math.cos(s.g[0])*inw[0]+Math.sin(s.g[0])*inw[1]>0.3}),'snake faucet, arena '+a+': the jet always points into the arena (inward within ~63 degrees)');
  }
  const f2=r2.evs.filter(x=>x.e==='warn'||x.e==='gush');
  ok(f2.length===0,'GFIRST=4: faucet scheduled after shrink start never fires ('+f2.length+' events)');
  ok(r2.play.every(s=>!s.g),'GFIRST=4: no stripe in any snapshot of any arena');
  console.log(bad?'FAUCET TESTS FAILED':'FAUCET TESTS PASSED');process.exit(bad)
})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});
