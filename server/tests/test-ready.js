// Lobby "ready" tests. Run: node test-ready.js  (spawns its own server on port 3115, FAST=10)
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3115,FAST:10},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=60000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(40)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,err:null};c.ws=new WS('ws://localhost:3115');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s')c.snap=m;if(m.t==='you')c.you=m;if(m.t==='err')c.err=m});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
const rd=(v,id)=>v.room.players.find(p=>p.id===id).rd;
(async()=>{try{await sleep(800);
 const A=cl(),B=cl(),C=cl();await Promise.all([A.open,B.open,C.open]);
 A.send({t:'create',name:'Ani'});await until(()=>A.you);const code=A.you.code;
 B.send({t:'join',code,name:'Budi'});C.send({t:'join',code,name:'Citra'});await until(()=>A.room.players.length===3&&B.you&&C.you);
 ok(rd(A,A.you.id)===1,'the host always counts as ready');
 ok(rd(A,B.you.id)===0&&rd(A,C.you.id)===0,'guests start out not ready');

 // ---- the host cannot start until every guest is ready ----
 A.send({t:'start'});await until(()=>A.err);ok(A.room.st==='lobby'&&/2 players/i.test(A.err.m),'start refused with two guests not ready ("'+A.err.m+'")');
 B.send({t:'ready',v:1});await until(()=>rd(A,B.you.id)===1&&rd(C,B.you.id)===1);ok(true,'a guest taps ready: host and the other guest see it');
 A.err=null;A.send({t:'start'});await until(()=>A.err);ok(A.room.st==='lobby'&&/Citra/.test(A.err.m),'still refused, and the message names who is missing ("'+A.err.m+'")');
 B.send({t:'ready',v:0});await until(()=>rd(A,B.you.id)===0);ok(true,'a guest can take ready back');
 B.send({t:'ready',v:1});C.send({t:'ready',v:1});await until(()=>rd(A,B.you.id)===1&&rd(A,C.you.id)===1);
 A.send({t:'ready',v:0});await sleep(200);ok(rd(A,A.you.id)===1,'the host cannot un-ready itself');
 // ---- bots never block, offline guests never block ----
 A.send({t:'addbot'});await until(()=>A.room.players.length===4);ok(A.room.players.find(p=>p.bot).rd===1,'bots are always ready');
 C.send({t:'ready',v:0});await until(()=>rd(A,C.you.id)===0);C.ws.close();await until(()=>A.room.players.find(p=>p.id===C.you.id).on===false);
 A.send({t:'start'});await until(()=>A.room.st==='count'||A.room.st==='play');ok(true,'an offline guest who was not ready does not block the start');
 // ---- ready is a lobby thing ----
 B.send({t:'ready',v:0});await sleep(250);ok(rd(A,B.you.id)===1,'ready cannot be changed during a match');
 // ---- after the match everybody has to get ready again ----
 await until(()=>A.room.st==='final',120000);
 A.send({t:'again'});await until(()=>A.room.st==='lobby');
 ok(rd(A,B.you.id)===0,'after the match the guests are not ready any more');
 // a guest who joins late is not ready either
 const D=cl();await D.open;D.send({t:'join',code,name:'Dedi'});await until(()=>D.you&&A.room.players.some(p=>p.id===D.you.id));ok(rd(A,D.you.id)===0,'a new guest is not ready');
 // the host leaves: the next human becomes host and counts as ready, the old one is no longer special
 A.send({t:'leave'});await until(()=>B.room.host!==A.you.id);const nh=B.room.host;ok(rd(B,nh)===1,'a new host counts as ready');
 // solo Quick Play is not affected
 const Q=cl();await Q.open;Q.send({t:'create',name:'Solo',quick:1,bots:2});await until(()=>Q.room&&Q.room.st==='count');ok(true,'Quick Play starts at once, no ready needed');
 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();
