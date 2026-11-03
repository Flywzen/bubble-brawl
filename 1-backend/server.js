const http = require('http'), fs = require('fs'), path = require('path'), { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, FAST = +process.env.FAST || 1; // FAST>1 is only for automated tests
const DT = 1 / 30, ROUND = 45 / FAST, SHRINK_AT = 15 / FAST, SHRINK_LEN = 20 / FAST;
const R0 = 300, RMIN = 130, SR = 22, ACC = 600, FR = 0.95, VCAP = 700, DASHV = 380, CD = 3, BCD = 6, BR = 125, BIMP = 360, MAXP = 8, ROUNDS = 3;
// arena: 0 sink (circle), 1 toilet (oval), 2 bathtub (rounded rectangle). true = outside; same as AX.d on the client
const OUT = [(x, y) => Math.hypot(x, y) > R0, (x, y) => Math.hypot(x / 270, y / 285) > 1,
  (x, y) => { const qx = Math.abs(x) - 170, qy = Math.abs(y) - 95; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) > 130; }];
// sink faucet gush (only before the arena starts shrinking): aimed jet. GW warn time, GD active time, GI gap between gushes, GA push accel, GHW half width, GO nozzle position
const GW = 1.2, GD = 1.5, GI = 10, GA = 700, GHW = 38, GOY = -290;
const rooms = new Map();

const srv = http.createServer((q, r) => {
  if (q.url === '/health') return r.end('ok');
  const page = path.join(__dirname, 'public', 'index.html'); // optional: only exists when frontend is bundled with the server
  if (!fs.existsSync(page)) { r.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return r.end('BUBBLE BRAWL game server is running. The game page is hosted separately.'); }
  if (q.url.split('?')[0] === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('window.BRAWL_SERVER = "";'); } // single-service mode: same host
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end(fs.readFileSync(page));
});
const wss = new WebSocketServer({ server: srv });
const rid = () => Math.random().toString(36).slice(2, 10);
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (rooms.has(c)); return c; };
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const all = (r, o) => { const s = JSON.stringify(o); for (const p of r.players) if (p.connected && p.ws.readyState === 1) p.ws.send(s); };
const info = r => ({ t: 'room', code: r.code, host: r.host, st: r.st, round: r.round, log: r.log, res: r.res,
  players: r.players.map(p => ({ id: p.id, name: p.name, ci: p.ci, score: p.score, on: p.connected, wait: p.wait, in: p.in })) });

function mkp(room, name, ws) {
  const used = new Set(room.players.map(p => p.ci)); let ci = 0; while (used.has(ci)) ci++;
  return { id: rid(), token: rid() + rid(), name: String(name || '').trim().slice(0, 12) || 'Sabun', ci, ws, connected: true,
    score: 0, wait: room.st !== 'lobby', in: false, x: 0, y: 0, vx: 0, vy: 0, alive: false, ix: 0, iy: 0, fa: 0, cd: 0, bcd: 0 };
}
function startRound(r) {
  r.round++; r.a = r.ord[(r.round - 1) % 3]; r.R = R0; r.g = null; r.gn = +process.env.GFIRST || 8; r.st = 'count'; r.tmr = 3; r.t = 0; r.ev = [];
  const ps = r.players.filter(p => p.in);
  ps.forEach((p, i) => {
    const a = i / ps.length * Math.PI * 2 + r.round * 0.7, d = R0 * 0.62;
    Object.assign(p, { x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, alive: true, cd: 0, bcd: 0, ix: 0, iy: 0 });
    p.fa = Math.atan2(-p.y, -p.x);
  });
  all(r, info(r));
}
function snap(r) {
  all(r, { t: 's', a: r.a, st: r.st, r: r.round, tm: Math.round((r.st === 'play' ? Math.max(0, ROUND - r.t) : r.tmr) * 10) / 10, R: Math.round(r.R * 10) / 10, g: r.g ? [+r.g.ang.toFixed(2), r.g.ph, +r.g.tm.toFixed(1)] : 0,
    p: r.players.filter(p => p.in).map(p => [p.id, +p.x.toFixed(1), +p.y.toFixed(1), Math.round(p.vx), Math.round(p.vy), p.alive ? 1 : 0, +p.cd.toFixed(1), +p.fa.toFixed(2), +p.bcd.toFixed(1)]), ev: r.ev });
  r.ev = [];
}
function step(r) {
  const ps = r.players.filter(p => p.in && p.alive); r.t += DT;
  r.R = r.t < SHRINK_AT ? R0 : R0 - (R0 - RMIN) * Math.min(1, (r.t - SHRINK_AT) / SHRINK_LEN);
  const k = r.R / R0;
  if (r.a === 0 && ps.length && r.t < SHRINK_AT) { // sink: warn first (stripe on the water), then the jet pushes everyone inside the stripe. Faucet is off once the water starts shrinking
    if (!r.g) { if (r.t >= r.gn) { const t = ps[Math.random() * ps.length | 0], ang = Math.max(-1.1, Math.min(1.1, Math.atan2(t.x, t.y - GOY) + (Math.random() - .5) * .3)); r.g = { ang, ph: 0, tm: GW }; r.ev.push(['warn', +ang.toFixed(2)]); } }
    else if ((r.g.tm -= DT) <= 0) { if (r.g.ph === 0) { r.g.ph = 1; r.g.tm = GD; r.ev.push(['gush', +r.g.ang.toFixed(2)]); } else { r.g = null; r.gn = r.t + GI; } }
  } else if (r.g) r.g = null; // shrinking started (or nobody left): cancel any warning/gush in progress
  for (const p of ps) {
    p.cd = Math.max(0, p.cd - DT); p.bcd = Math.max(0, p.bcd - DT);
    const ix = p.connected ? p.ix : 0, iy = p.connected ? p.iy : 0; // disconnected: input zeroed, body can still be pushed
    let gx = 0, gy = 0;
    if (r.g && r.g.ph === 1) { const dx = Math.sin(r.g.ang), dy = Math.cos(r.g.ang), rx = p.x, ry = p.y - GOY; if (rx * dx + ry * dy > 0 && Math.abs(rx * dy - ry * dx) < GHW) { gx = dx * GA; gy = dy * GA; } }
    p.vx = (p.vx + (ix * ACC + gx) * DT) * FR; p.vy = (p.vy + (iy * ACC + gy) * DT) * FR;
    const s = Math.hypot(p.vx, p.vy); if (s > VCAP) { p.vx *= VCAP / s; p.vy *= VCAP / s; }
    p.x += p.vx * DT; p.y += p.vy * DT;
  }
  for (let i = 0; i < ps.length; i++) for (let k = i + 1; k < ps.length; k++) {
    const a = ps[i], b = ps[k]; let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d < 2 * SR) {
      if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
      const nx = dx / d, ny = dy / d, ov = (2 * SR - d) / 2;
      a.x += nx * ov; a.y += ny * ov; b.x -= nx * ov; b.y -= ny * ov;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel < 0) {
        const j = -(1 + 1.15) * rel / 2;
        a.vx += j * nx; a.vy += j * ny; b.vx -= j * nx; b.vy -= j * ny;
        if (-rel > 60) r.ev.push(['hit', Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2), Math.round(-rel)]);
      }
    }
  }
  for (const p of ps) if (OUT[r.a](p.x / k, p.y / k)) { p.alive = false; r.ev.push(['out', p.id, Math.round(p.x), Math.round(p.y)]); }
  const alive = ps.filter(p => p.alive), pts = {}; let winner = null, done = false, timeout = false;
  if (alive.length === 1) { winner = alive[0].id; pts[winner] = 3; done = true; }
  else if (alive.length === 0) done = true; // everyone fell on the same step: draw
  else if (r.t >= ROUND) { alive.forEach(p => pts[p.id] = 1); done = true; timeout = true; }
  if (done) {
    r.g = null;
    for (const p of r.players) if (pts[p.id]) p.score += pts[p.id];
    r.log.push({ n: r.round, w: winner, pts, to: timeout });
    r.st = 'end'; r.tmr = 4.5; snap(r); all(r, info(r));
  }
}
function finish(r) {
  const ps = r.players.filter(p => p.in), m = Math.max(...ps.map(p => p.score));
  r.res = { winners: ps.filter(p => p.score === m).map(p => p.id) }; r.st = 'final'; all(r, info(r));
}
function tick() {
  for (const [c, r] of rooms) {
    if (!r.players.some(p => p.connected)) { r.empty = r.empty || Date.now(); if (Date.now() - r.empty > 60000) rooms.delete(c); continue; }
    r.empty = 0;
    if (r.st === 'count') { r.tmr -= DT; if (r.tmr <= 0) { r.st = 'play'; r.t = 0; all(r, info(r)); } }
    else if (r.st === 'play') step(r);
    else if (r.st === 'end') { r.tmr -= DT; if (r.tmr <= 0) { if (r.round >= ROUNDS) finish(r); else startRound(r); } }
    if (['count', 'play', 'end'].includes(r.st) && ++r.k % 2 === 0) snap(r);
  }
}
let last = Date.now(), acc = 0;
setInterval(() => { const n = Date.now(); acc += Math.min(.25, (n - last) / 1000); last = n; while (acc >= DT) { acc -= DT; tick(); } }, 8);

wss.on('connection', ws => {
  ws.live = true; ws.on('pong', () => ws.live = true);
  let room = null, pl = null;
  const attach = (r, p) => {
    room = r; pl = p; p.ws = ws; p.connected = true;
    if (!r.players.some(x => x.id === r.host && x.connected)) r.host = p.id;
    send(ws, { t: 'you', id: p.id, token: p.token, code: r.code }); all(r, info(r));
  };
  ws.on('message', d => {
    let m; try { m = JSON.parse(d); } catch { return; }
    if (m.t === 'create' && !room) {
      const r = { code: newCode(), players: [], host: null, st: 'lobby', round: 0, log: [], res: null, tmr: 0, t: 0, ev: [], k: 0, R: R0, a: 0, ord: [0, 1, 2] };
      rooms.set(r.code, r); const p = mkp(r, m.name, ws); r.players.push(p); attach(r, p);
    } else if (m.t === 'join' && !room) {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return send(ws, { t: 'err', m: 'Room not found', fatal: 1 });
      let p = m.token && r.players.find(x => x.token === m.token);
      if (p) { if (p.ws && p.ws !== ws && p.ws.readyState === 1) p.ws.close(); }
      else { if (r.players.length >= MAXP) return send(ws, { t: 'err', m: 'Room is full', fatal: 1 }); p = mkp(r, m.name, ws); r.players.push(p); }
      attach(r, p);
    } else if (!room) return;
    else if (m.t === 'start') {
      if (pl.id !== room.host || room.st !== 'lobby') return;
      const on = room.players.filter(p => p.connected);
      if (on.length < 2) return send(ws, { t: 'err', m: 'Need at least 2 players' });
      room.players = on; room.players.forEach(p => { p.in = true; p.wait = false; p.score = 0; });
      room.ord = [0, 1, 2].sort(() => Math.random() - .5);
      room.round = 0; room.log = []; room.res = null; startRound(room);
    } else if (m.t === 'in') {
      let x = +m.x || 0, y = +m.y || 0; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      pl.ix = x; pl.iy = y; if (l > 0.2) pl.fa = Math.atan2(y, x);
    } else if (m.t === 'dash') {
      if (room.st !== 'play' || !pl.in || !pl.alive || pl.cd > 0) return;
      pl.vx += Math.cos(pl.fa) * DASHV; pl.vy += Math.sin(pl.fa) * DASHV; pl.cd = CD;
      room.ev.push(['dash', pl.id, Math.round(pl.x), Math.round(pl.y)]);
    } else if (m.t === 'burst') {
      if (room.st !== 'play' || !pl.in || !pl.alive || pl.bcd > 0) return;
      pl.bcd = BCD;
      for (const o of room.players) if (o !== pl && o.in && o.alive) {
        const dx = o.x - pl.x, dy = o.y - pl.y, d = Math.hypot(dx, dy) || 1;
        if (d < BR) { const f = BIMP * (1 - d / (BR * 1.3)); o.vx += dx / d * f; o.vy += dy / d * f; }
      }
      room.ev.push(['burst', pl.id, Math.round(pl.x), Math.round(pl.y)]);
    } else if (m.t === 'cheer') { // spectators (eliminated / waiting players) cheer; living players cannot
      const n = Date.now();
      if (!['play', 'end'].includes(room.st) || (pl.in && pl.alive && room.st === 'play') || n - (pl.cheerAt || 0) < 700) return;
      pl.cheerAt = n; room.ev.push(['cheer', pl.id]);
    } else if (m.t === 'again') {
      if (room.st !== 'final') return;
      room.players = room.players.filter(p => p.connected);
      room.players.forEach(p => { p.wait = false; p.in = false; p.score = 0; });
      room.st = 'lobby'; room.round = 0; room.log = []; room.res = null; all(room, info(room));
    }
  });
  ws.on('close', () => {
    if (!room || pl.ws !== ws) return;
    const r = room, p = pl; p.connected = false;
    if (r.host === p.id) { const n = r.players.find(x => x.connected); if (n) r.host = n.id; }
    if (r.st === 'lobby') setTimeout(() => {
      if (!p.connected && r.st === 'lobby' && r.players.includes(p)) { r.players = r.players.filter(x => x !== p); all(r, info(r)); }
    }, 8000);
    all(r, info(r));
  });
});
setInterval(() => wss.clients.forEach(c => { if (c.live === false) return c.terminate(); c.live = false; c.ping(); }), 25000);
srv.listen(PORT, '0.0.0.0', () => console.log('BUBBLE BRAWL di port ' + PORT));
