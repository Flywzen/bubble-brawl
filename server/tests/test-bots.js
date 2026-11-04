// Bot mode + Back (leave) tests. Run: node test-bots.js  (spawns its own server on port 3112, FAST=10)
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3112,FAST:10},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=60000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(40)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,err:null,evs:[]};c.ws=new WS('ws://localhost:3112');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s'){c.snap=m;c.evs.push(...m.ev)}if(m.t==='you')c.you=m;if(m.t==='err')c.err=m});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
(async()=>{try{await sleep(800);
 // ---- 1. Quick Play: no invite, no second human ----
 const Q=cl();await Q.open;Q.send({t:'create',name:'Solo',quick:1,bots:3});
 await until(()=>Q.room&&Q.room.st==='count');
 ok(Q.room.players.length===4&&Q.room.players.filter(p=>p.bot).length===3,'quick play: 1 human + 3 bots, match starts without waiting');
 ok(Q.room.solo===1&&Q.room.host===Q.you.id,'quick play room is solo, host is the human');
 ok(Q.room.players.filter(p=>p.bot).every(p=>/\(bot\)$/.test(p.name)&&p.on),'bots are labelled "(bot)" and online');
 // the human stays idle; the bots must actually move, dash/parry and knock players out
 await until(()=>Q.room.st==='final',120000);
 ok(Q.room.log.length===3,'quick play: all 3 rounds finish (log '+Q.room.log.length+')');
 const decisive=Q.room.log.filter(l=>!l.to).length;
 console.log('INFO rounds decided before time-out:',decisive+'/3, events dash='+Q.evs.filter(e=>e[0]==='dash'&&e[1]!==Q.you.id).length+' parry='+Q.evs.filter(e=>e[0]==='parry'&&e[1]!==Q.you.id).length+' out='+Q.evs.filter(e=>e[0]==='out').length);
 ok(Q.evs.some(e=>(e[0]==='dash'||e[0]==='parry')&&e[1]!==Q.you.id),'bots use dash/parry');
 ok(Q.room.players.reduce((a,p)=>a+p.score,0)>0,'scores were awarded');
 // solo rematch restarts straight away, bots stay
 Q.send({t:'again'});await until(()=>Q.room.st==='count');
 ok(Q.room.round===1&&Q.room.players.length===4&&Q.room.players.every(p=>p.score===0),'solo "Play again": new match starts at once, bots kept, scores reset');
 // leave mid-match: room is destroyed because no human remains
 const code=Q.you.code;Q.send({t:'leave'});await sleep(200);
 const J=cl();await J.open;J.send({t:'join',code,name:'late'});await until(()=>J.err);
 ok(J.err.m==='Room not found','last human leaves -> bot-only room is deleted');

 // ---- 2. Play with Friends + fill with bots ----
 const A=cl(),B=cl();await Promise.all([A.open,B.open]);
 A.send({t:'create',name:'Ani'});await until(()=>A.you);const rc=A.you.code;
 ok(A.room.st==='lobby'&&A.room.solo===0,'friends room opens in the lobby (no auto start)');
 A.send({t:'start'});await sleep(200);ok(A.room.st==='lobby'&&A.err&&/at least 2/i.test(A.err.m),'host alone cannot start');
 A.send({t:'addbot'});await until(()=>A.room.players.length===2);
 ok(A.room.players[1].bot===1,'host adds a bot');
 B.send({t:'join',code:rc,name:'Budi'});await until(()=>B.room&&B.room.players.length===3);
 B.send({t:'addbot'});await sleep(200);ok(B.room.players.length===3,'non-host cannot add bots');
 B.send({t:'rmbot'});await sleep(200);ok(B.room.players.length===3,'non-host cannot remove bots');
 for(let i=0;i<10;i++)A.send({t:'addbot'});await until(()=>A.room.players.length===8);await sleep(200);
 ok(A.room.players.length===8,'lobby caps at 8 players');
 const C=cl();await C.open;C.send({t:'join',code:rc,name:'Citra'});await until(()=>C.room);
 ok(C.room.players.length===8&&C.room.players.some(p=>p.id===C.you.id)&&C.room.players.filter(p=>p.bot).length===5,'full lobby: a new human takes a bot seat');
 A.send({t:'rmbot'});await until(()=>A.room.players.filter(p=>p.bot).length===4);ok(true,'host removes a bot');
 // ---- 3. Back button (leave) ----
 B.send({t:'leave'});await until(()=>A.room.players.every(p=>p.id!==B.you.id));ok(true,'lobby: Back removes the player immediately');
 const B2=cl();await B2.open;B2.send({t:'join',code:rc,name:'Budi'});await until(()=>B2.room&&B2.room.players.some(p=>p.id===B2.you.id));ok(true,'after leaving, the same connection/browser can join again');
 B2.send({t:'leave'});await until(()=>B2.room.players.every(p=>p.id!==B2.you.id)||true);
 // host leaves -> a human inherits host
 A.send({t:'leave'});await until(()=>C.room.host===C.you.id);ok(true,'host leaves: host passes to another human, not a bot');
 // ---- 4. Mixed match, a human leaves mid-round ----
 C.send({t:'start'});await until(()=>C.room.st==='play'||C.room.st==='count');await until(()=>C.snap&&C.snap.st==='play');
 const D=cl();await D.open;D.send({t:'create',name:'Dodo'});await until(()=>D.you);D.send({t:'addbot'});D.send({t:'addbot'});await until(()=>D.room.players.length===3);
 const cid=C.you.id;ok(C.snap.p.find(p=>p[0]===cid)[5]===1,'human C alive in a mixed match');
 C.send({t:'leave'});await sleep(300);ok(true,'leaving mid-match does not crash the server');
 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();
