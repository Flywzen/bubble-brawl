// Emote tests. Run: node tests/test-emote.js  (spawns its own server on port 3116)
const {spawn}=require('child_process'),WS=require('ws');
const sv=spawn('node',['server.js'],{env:{...process.env,PORT:3116},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=5000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timeout: '+f);await sleep(30)}};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
function cl(){const c={you:null,emo:[]};c.ws=new WS('ws://localhost:3116');
 c.ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='you')c.you=m;if(m.t==='emo')c.emo.push(m)});
 c.send=o=>c.ws.send(JSON.stringify(o));c.open=new Promise(r=>c.ws.on('open',r));return c}
(async()=>{try{await sleep(800);
 const A=cl(),B=cl(),L=cl();await Promise.all([A.open,B.open,L.open]);
 A.send({t:'create',name:'Ani'});await until(()=>A.you);B.send({t:'join',code:A.you.code,name:'Budi'});await until(()=>B.you);
 A.send({t:'emo',i:3});await until(()=>A.emo.length&&B.emo.length);
 ok(B.emo[0].id===A.you.id&&B.emo[0].i===3,'an emote reaches the other player with the sender id');
 ok(A.emo[0].i===3,'the sender sees it too');
 A.send({t:'emo',i:1});await sleep(300);ok(A.emo.length===1,'a second emote inside the cooldown is dropped');
 await sleep(1300);A.send({t:'emo',i:6});await until(()=>B.emo.length===2);ok(B.emo[1].i===6,'allowed again after the cooldown');
 for(const bad of [-1,7,2.5,'1',null,{}]){B.send({t:'emo',i:bad})}await sleep(300);ok(A.emo.length===2&&B.emo.length===2,'invalid emote indexes are ignored');
 L.send({t:'emo',i:0});await sleep(300);ok(L.emo.length===0,'someone outside a room cannot emote');
}catch(e){console.log('FAIL '+e.message);process.exitCode=1}sv.kill();setTimeout(()=>process.exit(),100)})();
