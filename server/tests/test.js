const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3111,FAST:10},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=60000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(50)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,err:null,evs:[]};c.ws=new WS('ws://localhost:3111');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s'){c.snap=m;c.evs.push(...m.ev)}if(m.t==='you')c.you=m;if(m.t==='err')c.err=m});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
(async()=>{try{await sleep(800);
 const A=cl(),B=cl(),C=cl();await Promise.all([A.open,B.open,C.open]);
 C.send({t:'join',code:'ZZZZ',name:'x'});await until(()=>C.err);ok(C.err.m==='Room not found','room not found');
 A.send({t:'create',name:'Ani'});await until(()=>A.you);const code=A.you.code;
 B.send({t:'join',code,name:'Budi'});await until(()=>B.you&&A.room.players.length===2);
 ok(A.room.players.length===2&&B.room.players.length===2,'dua client di room '+code);
 B.send({t:'start'});await sleep(200);ok(A.room.st==='lobby','non-host cannot start');
 // B runs off the arena each round -> A wins 3 rounds
 const run=setInterval(()=>{const e=B.snap&&B.snap.p.find(p=>p[0]===B.you.id);if(e&&!e[5]&&!B.ch&&['play','end'].includes(B.snap.st)){B.ch=1;B.send({t:'cheer'})}if(e&&B.snap.st==='play'){const l=Math.hypot(e[1],e[2])||1;B.send({t:'in',x:e[1]/l,y:e[2]/l})}},50);
 A.send({t:'start'});await sleep(200);ok(A.room.st==='lobby'&&A.err&&/ready/i.test(A.err.m),'host cannot start while the guest is not ready');
 B.send({t:'ready',v:1});await until(()=>(B.you&&A.room.players.find(p=>p.id===B.you.id)||{}).rd===1);A.send({t:'start'});await until(()=>A.room.st==='count');
 await until(()=>A.room.st==='final',90000);clearInterval(run);
 const sa=A.room.players.find(p=>p.id===A.you.id).score,sb=B.room.players.find(p=>p.id===B.you.id).score;
 ok(sa===9&&sb===0,`3-round score A=${sa} B=${sb} (must be 9/0)`);ok(A.room.res.winners.length===1&&A.room.res.winners[0]===A.you.id,'winner A');
 ok(A.room.log.length===3&&A.room.log.every(l=>l.w===A.you.id),'3-round log, A wins every round');ok(A.room.log.every(l=>!Object.keys(l.k||{}).length),'B walking off the edge alone gives A no kill (score stays 9)');
 ok(A.evs.some(e=>e[0]==='cheer'&&e[1]===B.you.id),'eliminated player can cheer, event reaches other clients');ok([0,1,2].includes(A.snap.a),'snapshot membawa id arena');ok(B.room.st==='final'&&JSON.stringify(A.room.res)===JSON.stringify(B.room.res),'hasil konsisten di kedua client');
 // rematch
 B.send({t:'again'});await until(()=>A.room.st==='lobby'&&B.room.st==='lobby');ok(A.room.players.every(p=>p.score===0),'rematch: same room, scores reset');
 // reconnect B (refresh)
 const tok=B.you.token,bid=B.you.id;B.ws.close();await until(()=>A.room.players.find(p=>p.id===bid).on===false);ok(true,'disconnect terdeteksi');
 const B2=cl();await B2.open;B2.send({t:'join',code,token:tok,name:'Budi'});await until(()=>B2.you);
 ok(B2.you.id===bid&&A.room.players.find(p=>p.id===bid).on,'reconnect restores the same player');
 // new player joins mid-game -> waits
 ok(A.room.players.find(p=>p.id===bid).rd===0,'after the rematch the guest has to get ready again');
 B2.send({t:'ready',v:1});await until(()=>(B2.you&&A.room.players.find(p=>p.id===B2.you.id)||{}).rd===1);A.send({t:'start'});await until(()=>A.room.st==='count');
 const D=cl();await D.open;D.send({t:'join',code,name:'Dedi'});await until(()=>D.room);
 ok(D.room.players.find(p=>p.id===D.you.id).wait,'new player mid-match is waiting');
 await until(()=>A.snap&&A.snap.st==='play');
 // dash & cooldown
 A.send({t:'cheer'});await sleep(200);ok(!A.evs.some(e=>e[0]==='cheer'&&e[1]===A.you.id),'living player cannot cheer');A.send({t:'dash'});await sleep(250);A.send({t:'dash'});
 await sleep(300);const cd=A.snap.p.find(p=>p[0]===A.you.id)[6];ok(cd>1.5&&cd<=3,'dash cooldown active ('+cd+'s), second dash rejected');
 ok(A.evs.filter(e=>e[0]==='dash').length===1,'exactly 1 dash event');
 A.send({t:'parry'});await sleep(150);A.send({t:'parry'});await sleep(300);const bc=A.snap.p.find(p=>p[0]===A.you.id)[8];ok(bc>3.4&&bc<=4,'parry cooldown active ('+bc+'s)');ok(A.evs.filter(e=>e[0]==='parry').length===1,'exactly 1 parry event');
 // host leaves mid-round
 A.ws.close();await until(()=>B2.room.host===bid);ok(true,'host moves to another player');
 const t0=B2.snap.tm;await sleep(700);ok(B2.snap.tm!==t0,'round keeps running after host leaves');
 // disconnected player stays and timer keeps running
 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();
