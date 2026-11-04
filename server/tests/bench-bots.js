// Optional benchmark (about 2.5 minutes, normal game speed): 6 Quick Play games with an idle human.
// Shows whether the bots actually fight. Run: node bench-bots.js
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3113,FAST:1},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function game(){return new Promise(res=>{const c={room:null,you:null};const ws=new WS('ws://localhost:3113');
 ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='you')c.you=m;if(m.t==='room'&&m.st==='final'){ws.close();res(c)}});
 ws.on('open',()=>ws.send(JSON.stringify({t:'create',name:'Idle',quick:1,bots:3})))})}
(async()=>{await sleep(800);const gs=await Promise.all(Array.from({length:6},game));sv.kill();
 let n=0,bw=0,hw=0,to=0,dr=0;
 for(const g of gs)for(const l of g.room.log){n++;if(l.w===g.you.id)hw++;else if(l.w)bw++;else if(l.to)to++;else dr++}
 console.log({rounds:n,wonByBot:bw,wonByIdleHuman:hw,timeouts:to,draws:dr});process.exit()})();
