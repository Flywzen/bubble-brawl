// Optional benchmark (about 3 minutes, normal game speed). For every bot difficulty it plays Quick Play matches (1 human + 3 bots)
// with a simple scripted "casual player" (chases the nearest soap, stays off the rim, dashes now and then, never parries)
// and reports how that player does. Easy should be clearly kinder than Normal, and Normal kinder than Hard.
// Run: node bench-bots.js   (GAMES=10 matches per level by default, FAST=1)
const {spawn}=require('child_process'),WS=require('ws');
const GAMES=+process.env.GAMES||10,NAMES=['easy','normal','hard'];
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3113,FAST:process.env.FAST||1},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function game(df){return new Promise(res=>{const c={room:null,you:null,dash:0,bd:0,bp:0};const ws=new WS('ws://localhost:3113');let n=0,lastDash=0;
 ws.on('message',d=>{const m=JSON.parse(d);
  if(m.t==='room')c.room=m;if(m.t==='you')c.you=m;if(m.t==='room'&&m.st==='final'){ws.close();res(c)}
  if(m.t==='s'){for(const e of m.ev){if((e[0]==='dash'||e[0]==='parry')&&e[1]!==c.you.id){if(e[0]==='dash')c.bd++;else c.bp++}}
   if(m.st!=='play'||++n%3)return; // act about 10 times a second, like a hand on a joystick
   const me=m.p.find(p=>p[0]===c.you.id);if(!me||!me[5])return;
   const foes=m.p.filter(p=>p[0]!==c.you.id&&p[5]);if(!foes.length)return;
   let t=foes[0],bd=1e9;for(const o of foes){const d=Math.hypot(o[1]-me[1],o[2]-me[2]);if(d<bd){bd=d;t=o}}
   const rim=Math.hypot(me[1],me[2])/Math.max(1,m.R);let dx=t[1]-me[1],dy=t[2]-me[2];
   if(rim>.62){dx=-me[1];dy=-me[2]} // too close to the edge: go back to the middle
   const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const j=(Math.random()-.5)*.6;
   ws.send(JSON.stringify({t:'in',x:dx*Math.cos(j)-dy*Math.sin(j),y:dx*Math.sin(j)+dy*Math.cos(j)}));
   if(me[6]<=0&&bd<170&&rim<.6&&Date.now()-lastDash>800&&Math.random()<.5){lastDash=Date.now();c.dash++;ws.send(JSON.stringify({t:'dash'}))}}});
 ws.on('open',()=>ws.send(JSON.stringify({t:'create',name:'Casual',quick:1,bots:3,df})))})}
(async()=>{await sleep(800);
 const out=await Promise.all(NAMES.map((_,df)=>Promise.all(Array.from({length:GAMES},()=>game(df)))));sv.kill();
 const rows=out.map((gs,df)=>{let rounds=0,hw=0,bw=0,to=0,dr=0,wins=0,pts=0,tot=0,bd=0,bp=0;
  for(const g of gs){const me=g.room.players.find(p=>p.id===g.you.id);pts+=me.score;tot+=g.room.players.reduce((a,p)=>a+p.score,0);if(g.room.res.winners.includes(g.you.id))wins++;bd+=g.bd;bp+=g.bp;
   for(const l of g.room.log){rounds++;if(l.w===g.you.id)hw++;else if(l.w)bw++;else if(l.to)to++;else dr++}}
  const r=x=>Math.round(x*100)/100;
  return{level:NAMES[df],matches:gs.length,'player wins match':Math.round(wins/gs.length*100)+'%','player wins round':Math.round(hw/rounds*100)+'%','bot wins round':Math.round(bw/rounds*100)+'%',timeouts:to,draws:dr,'player pts/match':r(pts/gs.length),'share of all pts':Math.round(pts/tot*100)+'%','bot dashes/match':r(bd/gs.length),'bot parries/match':r(bp/gs.length)}});
 console.table(rows);process.exit()})();
