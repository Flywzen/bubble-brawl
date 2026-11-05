// Bot difficulty tests. Run: node test-difficulty.js  (spawns its own server on port 3114, FAST=10)
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3114,FAST:10},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=60000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(40)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={room:null,snap:null,you:null,err:null};c.ws=new WS('ws://localhost:3114');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='room')c.room=m;if(m.t==='s')c.snap=m;if(m.t==='you')c.you=m;if(m.t==='err')c.err=m});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
// create a room with these extra fields, report the difficulty the room starts with, then leave
async function startsWith(extra,quick){const c=cl();await c.open;c.send({t:'create',name:'T',quick:quick?1:0,bots:quick?1:0,...extra});await until(()=>c.room);const df=c.room.df;c.send({t:'leave'});await sleep(60);c.ws.close();return df}
(async()=>{try{await sleep(800);
 // ---- 1. the room starts with the difficulty the creator picked; anything odd means normal ----
 ok(await startsWith({df:0},true)===0,'quick play with df 0 -> easy');
 ok(await startsWith({df:2},true)===2,'quick play with df 2 -> hard');
 ok(await startsWith({df:1},false)===1,'friends room with df 1 -> normal');
 ok(await startsWith({df:0},false)===0,'friends room with df 0 -> easy');
 ok(await startsWith({},true)===1,'no df sent (old client) -> normal');
 for(const bad of [3,-1,1.5,'2','x',null,true,[2]])ok(await startsWith({df:bad},false)===1,'invalid df '+JSON.stringify(bad)+' -> normal');

 // ---- 2. only the host changes it, only in the lobby (or after a match) ----
 const A=cl(),B=cl();await Promise.all([A.open,B.open]);
 A.send({t:'create',name:'Ani',df:1});await until(()=>A.you);const code=A.you.code;
 B.send({t:'join',code,name:'Budi'});await until(()=>B.room&&B.room.players.length===2);
 A.send({t:'setdiff',df:2});await until(()=>A.room.df===2);await until(()=>B.room.df===2);ok(true,'host changes it in the lobby, everybody sees it');
 B.send({t:'setdiff',df:0});await sleep(250);ok(A.room.df===2&&B.room.df===2,'a non-host cannot change it');
 for(const bad of [3,-1,0.5,'0',null])A.send({t:'setdiff',df:bad});await sleep(250);ok(A.room.df===2,'invalid values are ignored');
 A.send({t:'setdiff',df:0});await until(()=>A.room.df===0);ok(true,'host can lower it again');
 A.send({t:'addbot'});await until(()=>A.room.players.length===3);
 B.send({t:'ready',v:1});await until(()=>(B.you&&A.room.players.find(p=>p.id===B.you.id)||{}).rd===1);A.send({t:'start'});await until(()=>A.snap&&A.snap.st==='play');
 A.send({t:'setdiff',df:2});await sleep(250);ok(A.room.df===0&&B.room.df===0,'it cannot be changed in the middle of a match');
 A.send({t:'leave'});B.send({t:'leave'});await sleep(200);

 // ---- 3. a whole solo match, then change it before the rematch ----
 const Q=cl();await Q.open;Q.send({t:'create',name:'Solo',quick:1,bots:3,df:0});await until(()=>Q.room&&Q.room.st==='count');
 ok(Q.room.df===0&&Q.room.players.filter(p=>p.bot).length===3,'quick play match runs with easy bots');
 await until(()=>Q.room.st==='final',120000);ok(Q.room.log.length===3,'a full match with easy bots finishes');
 Q.send({t:'setdiff',df:2});await until(()=>Q.room.df===2);ok(true,'after the match the player can raise it');
 Q.send({t:'again'});await until(()=>Q.room.st==='count');
 ok(Q.room.df===2&&Q.room.round===1,'the rematch keeps the new difficulty');
 // every level plays: bots must move and fight without crashing the server
 for(const df of [0,1,2]){Q.send({t:'leave'});await sleep(150);const R=cl();await R.open;R.send({t:'create',name:'L'+df,quick:1,bots:3,df});await until(()=>R.snap&&R.snap.st==='play');
  const a=R.snap.p.map(p=>[p[1],p[2]]);await sleep(1500);const moved=R.snap.p.some((p,i)=>Math.hypot(p[1]-a[i][0],p[2]-a[i][1])>8);
  ok(moved,'level '+df+': bots move');R.send({t:'leave'});await sleep(100);R.ws.close()}
 console.log(process.exitCode?'ADA GAGAL':'ALL PASSED');
}catch(e){console.log('ERROR',e.message);process.exitCode=1}finally{sv.kill();setTimeout(()=>process.exit(),100)}})();
