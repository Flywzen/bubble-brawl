const http = require('http'), fs = require('fs'), path = require('path'), { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, FAST = +process.env.FAST || 1;
const DT = 1 / 30, ROUND = 45 / FAST, SHRINK_AT = 15 / FAST, SHRINK_LEN = 20 / FAST;
const R0 = 300, RMIN = 130, SR = 22, ACC = 600, FR = 0.95, VCAP = 700, DASHV = 380, CD = 3, MAXP = 8, ROUNDS = 3;
const OUT = [(x, y) => Math.hypot(x, y) > R0, (x, y) => Math.hypot(x / 270, y / 285) > 1,
  (x, y) => { const qx = Math.abs(x) - 170, qy = Math.abs(y) - 95; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) > 130; }];
const PWIN = .3, PCD = 4, PCDOK = 2, PREF = 1.25, PMIN = 260, PSTUN = .9;
const GW = 1.2, GD = 1.5, GI = 4, GA = process.env.GA != null ? +process.env.GA : 700, GHW = 38, GFIRST = 4;
const PT_WIN = 3, PT_SURV = 1, PT_KILL = 1, KWIN = 3, KMIN = 40;
const PORTS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI], NZ = [[235, 235], [205, 220], [235, 160]], GSWING = 1.1, NS = 28, NE = 7, EMO_CD = 1500;
const SKCD = [7.5, 6.5, 7, 7.5, 7.5, 6.5, 8, 7.5, 7, 8.5, 7.5, 8, 8, 7.5, 8, 7, 7.5, 7.5, 8, 9, 7.5, 7, 8.5, 7.5, 8, 9, 8, 8.5];
const wrapA = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const rooms = new Map();
let TICKN = 0;

const srv = http.createServer((q, r) => {
  if (q.url === '/health') return r.end('ok');
  if (q.url === '/version') return r.end(JSON.stringify({ build: 'char-skills-1', features: ['bots', 'difficulty', 'ready', 'quick', 'parry', 'soap', 'ts-snapshots', 'snake-faucet', 'soap16', 'soap18', 'kills', 'faucet-always', 'skills'] }));
  const page = path.join(__dirname, 'public', 'index.html');
  if (!fs.existsSync(page)) { r.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return r.end('BUBBLE BRAWL game server is running. The game page is hosted separately.'); }
  if (q.url.split('?')[0] === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('window.BRAWL_SERVER = "";'); }
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end(fs.readFileSync(page));
});
const wss = new WebSocketServer({ server: srv });
const rid = () => Math.random().toString(36).slice(2, 10);
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (rooms.has(c)); return c; };
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const all = (r, o) => { const s = JSON.stringify(o); for (const p of r.players) if (p.connected && p.ws && p.ws.readyState === 1) p.ws.send(s); };
const info = r => ({ t: 'room', code: r.code, host: r.host, st: r.st, round: r.round, log: r.log, res: r.res, solo: r.solo ? 1 : 0, df: r.df, sk: r.sk,
  players: r.players.map(p => ({ id: p.id, name: p.name, ci: p.ci, score: p.score, kl: p.kills, on: p.connected, wait: p.wait, in: p.in, bot: p.bot ? 1 : 0, rd: p.bot || p.id === r.host || p.ready ? 1 : 0 })) });

function mkp(room, name, ws, want) {
  const used = new Set(room.players.map(p => p.ci)); let ci = Number.isInteger(want) && want >= 0 && want < NS && !used.has(want) ? want : 0; while (used.has(ci)) ci++;
  return { id: rid(), token: rid() + rid(), name: String(name || '').trim().slice(0, 12) || 'Sabun', ci, ws, connected: true,
    score: 0, kills: 0, ready: false, lh: 0, lht: -99, wait: room.st !== 'lobby', in: false, x: 0, y: 0, vx: 0, vy: 0, alive: false, ix: 0, iy: 0, fa: 0, cd: 0, pcd: 0, par: 0, stun: 0, scd: 0, skt: 0, skp: 0, inv: 0, slw: 0, skh: {} };
}
const BOTN = ['Foamy', 'Suds', 'Squeaky', 'Slippy', 'Lather', 'Scrubby', 'Bubbly', 'Pumice'];
const DIFFS = [
  { n: 'easy',   th: [.42, .30], sk: [.50, .15], jt: 1.3, wd: .12, dp: .20, pp: .08, sp: .12, pr: 95,  fd: .45, ea: .90, sm: 0 },
  { n: 'normal', th: [.24, .16], sk: [.68, .17], jt: .8,  wd: .07, dp: .45, pp: .30, sp: .28, pr: 110, fd: .80, ea: .97, sm: .6 },
  { n: 'hard',   th: [.14, .12], sk: [.80, .20], jt: .5,  wd: .04, dp: .75, pp: .60, sp: .50, pr: 125, fd: 1,   ea: 1,   sm: 1 }];
const DDEF = 1, cdf = v => Number.isInteger(v) && v >= 0 && v < DIFFS.length ? v : DDEF;
const csk = v => v === 0 || v === false ? 0 : 1;
function addBot(r) {
  const used = new Set(r.players.map(p => p.name)), free = BOTN.filter(n => !used.has(n + ' (bot)'));
  const usedCi = new Set(r.players.map(x => x.ci)), freeCi = Array.from({ length: NS }, (_, i) => i).filter(i => !usedCi.has(i));
  const p = mkp(r, 'bot', null, freeCi[Math.random() * freeCi.length | 0]); p.bot = true; p.token = ''; p.name = (free[Math.random() * free.length | 0] || 'Bot') + ' (bot)';
  p.rk = Math.random(); p.think = Math.random() * .3; r.players.push(p); return p;
}
function edgeU(r, x, y) {
  const l = Math.hypot(x, y); if (l < 1) return 0;
  const k = r.R / R0, dx = x / l, dy = y / l; let lo = 0, hi = R0 * 1.3;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (OUT[r.a](dx * m / k, dy * m / k)) hi = m; else lo = m; }
  return l / Math.max(1, lo);
}
function doDash(r, p) { p.vx += Math.cos(p.fa) * DASHV; p.vy += Math.sin(p.fa) * DASHV; p.cd = CD; r.ev.push(['dash', p.id, Math.round(p.x), Math.round(p.y)]); }
function doParry(r, p) { p.pcd = PCD; p.par = PWIN; r.ev.push(['parry', p.id, Math.round(p.x), Math.round(p.y)]); }
function parryHit(r, P, A, m, c) {
  const vn = (A.vx - P.vx) * m[0] + (A.vy - P.vy) * m[1], nv = Math.max(PMIN, c * PREF);
  A.vx += m[0] * (nv - vn); A.vy += m[1] * (nv - vn); A.stun = PSTUN; P.par = 0; P.pcd = PCDOK;
  r.ev.push(['parried', P.id, A.id, Math.round((P.x + A.x) / 2), Math.round((P.y + A.y) / 2)]);
}
function skHit(r, p, o, vx, vy, stun = 0, slw = 0, brk = false) {
  if (!o || o === p || !o.alive) return;
  if (brk) { o.par = 0; o.inv = 0; }
  if (o.inv > 0) return;
  if (o.par > 0) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
    p.lh = o.id; p.lht = r.t; parryHit(r, o, p, [dx / d, dy / d], Math.hypot(vx, vy)); return;
  }
  o.vx += vx; o.vy += vy; o.lh = p.id; o.lht = r.t;
  if (stun > o.stun) o.stun = stun;
  if (slw > o.slw) o.slw = slw;
  const st = Math.round(Math.hypot(vx, vy));
  if (st > 60) r.ev.push(['hit', Math.round((p.x + o.x) / 2), Math.round((p.y + o.y) / 2), st]);
}
function skRad(r, p, rad, imp, stun = 0, slw = 0, brk = false) {
  for (const o of r.players) if (o.in && o.alive && o !== p) {
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
    if (d <= rad) { const l = d || 1, k = imp * (.75 + .25 * (1 - d / rad)); skHit(r, p, o, dx / l * k, dy / l * k, stun, slw, brk); }
  }
}
function skCone(r, p, rad, minCos, imp, stun = 0, slw = 0, pull = false) {
  const fx = Math.cos(p.fa), fy = Math.sin(p.fa);
  for (const o of r.players) if (o.in && o.alive && o !== p) {
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
    if (d <= rad) {
      const l = d || 1, ux = dx / l, uy = dy / l;
      if (ux * fx + uy * fy >= minCos) {
        const vx = (pull ? -ux : fx * .65 + ux * .35) * imp, vy = (pull ? -uy : fy * .65 + uy * .35) * imp;
        skHit(r, p, o, vx, vy, stun, slw);
      }
    }
  }
}
function doSkill(r, p) {
  if (!r.sk) return;
  const ci = p.ci; p.scd = SKCD[ci] || 7.5; p.skh = {};
  if (ci === 26) {
    let bd = 240, tgt = null;
    for (const o of r.players) if (o.in && o.alive && o !== p) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; tgt = o; } }
    if (tgt) p.fa = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  }
  const fx = Math.cos(p.fa), fy = Math.sin(p.fa);
  if (ci === 0) { skRad(r, p, 155, -230, 0, .4); p.skt = .35; p.skp = .32; }
  else if (ci === 1) { p.vx += fx * 470; p.vy += fy * 470; p.skt = .95; }
  else if (ci === 2) { skRad(r, p, 140, 390, .65); p.skt = .45; }
  else if (ci === 3) { p.vx += fx * 430; p.vy += fy * 430; p.inv = .45; p.skt = .45; p.skp = .42; }
  else if (ci === 4) { p.vx += fx * 380; p.vy += fy * 380; p.skt = 1.1; }
  else if (ci === 5) { p.vx += fx * 430; p.vy += fy * 430; skCone(r, p, 125, .15, 460); p.skt = .45; }
  else if (ci === 6) { skRad(r, p, 155, 480); p.skt = .6; }
  else if (ci === 7) { skCone(r, p, 175, -.1, 210, .5, 1.6, true); p.skt = .6; }
  else if (ci === 8) { skCone(r, p, 195, .25, 530, .35); p.skt = .45; }
  else if (ci === 9) { skCone(r, p, 215, .2, 430, .85, 1.1, true); p.skt = .65; }
  else if (ci === 10) { p.vx += fx * 410; p.vy += fy * 410; skRad(r, p, 95, 450); p.skt = .65; }
  else if (ci === 11) { p.vx += fx * 310; p.vy += fy * 310; skRad(r, p, 140, 350, 1.05); p.skt = .6; }
  else if (ci === 12) { p.inv = .55; p.skt = .6; p.skp = .42; skRad(r, p, 120, 250); }
  else if (ci === 13) { p.vx += fx * 290; p.vy += fy * 290; skRad(r, p, 145, 500, .45); p.skt = .5; }
  else if (ci === 14) { skRad(r, p, 160, 360, 1.15, .8); p.skt = .65; }
  else if (ci === 15) { p.vx += fx * 270; p.vy += fy * 270; skCone(r, p, 135, .15, 550, .4); p.skt = .45; }
  else if (ci === 16) { p.vx += fx * 460; p.vy += fy * 460; p.skt = 1.05; }
  else if (ci === 17) { p.inv = .7; p.skt = .7; skRad(r, p, 142, 430); }
  else if (ci === 18) { p.vx += fx * 490; p.vy += fy * 490; p.inv = .4; p.skt = .85; skRad(r, p, 90, 460); }
  else if (ci === 19) { p.inv = .35; p.skt = .5; r.prj.push({ ow: p.id, ci: 19, x: p.x + fx * 26, y: p.y + fy * 26, vx: fx * 520, vy: fy * 520, r: 36, t: 1.35, hit: {} }); }
  else if (ci === 20) { p.vx += fx * 470; p.vy += fy * 470; p.skt = .65; skCone(r, p, 135, 0, 500); }
  else if (ci === 21) { p.vx += fx * 560; p.vy += fy * 560; p.skt = .5; skCone(r, p, 125, .2, 510); }
  else if (ci === 22) { p.skt = .75; p.skp = .35; skRad(r, p, 155, 450, .45); }
  else if (ci === 23) { p.vx -= fx * 110; p.vy -= fy * 110; p.skt = .55; skCone(r, p, 155, -.2, 490, .35); }
  else if (ci === 24) {
    let tx = p.x + fx * 135, ty = p.y + fy * 135, u = edgeU(r, tx, ty);
    if (u > .85) { tx *= .85 / u; ty *= .85 / u; }
    p.x = tx; p.y = ty; p.vx = fx * 260; p.vy = fy * 260; p.skt = .45;
    skRad(r, p, 110, 520, .5, 0, true);
  } else if (ci === 25) { p.stun = 0; p.slw = 0; p.inv = 1.0; p.skt = 1.0; skRad(r, p, 145, 460, .35); }
  else if (ci === 26) { p.vx += fx * 350; p.vy += fy * 350; p.skt = .75; skCone(r, p, 175, .05, 520, .4); }
  else if (ci === 27) { p.skt = .75; skCone(r, p, 175, -.2, 370, .6, 2.0); }
  r.ev.push(['sk', p.id, ci, Math.round(p.x), Math.round(p.y), +p.fa.toFixed(2)]);
}
function botThink(r, b, ps) {
  b.think -= DT; if (b.think > 0) return; const D = DIFFS[r.df]; b.think = D.th[0] + Math.random() * D.th[1];
  if (Date.now() > (b.eu || 0) && Math.random() < 0.02) { b.eu = Date.now() + 6000 + Math.random() * 6000; all(r, { t: 'emo', id: b.id, i: Math.floor(Math.random() * NE) }); }
  const foes = ps.filter(o => o !== b); if (!foes.length) { b.ix = b.iy = 0; return; }
  const u = edgeU(r, b.x, b.y), pu = edgeU(r, b.x + b.vx * .55, b.y + b.vy * .55), danger = Math.max(u, pu) * D.ea;
  const cl = Math.hypot(b.x, b.y) || 1, cx = -b.x / cl, cy = -b.y / cl;
  let tgt = null, best = 1e9;
  for (const o of foes) { const d = Math.hypot(o.x - b.x, o.y - b.y) * (1.25 - Math.min(1, edgeU(r, o.x, o.y)) * .5 * D.sm); if (d < best) { best = d; tgt = o; } }
  const tl = Math.hypot(tgt.x, tgt.y) || 1, ax = tgt.x + tgt.x / tl * 26 * D.sm, ay = tgt.y + tgt.y / tl * 26 * D.sm;
  let dx = ax - b.x, dy = ay - b.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  const late = r.t > SHRINK_AT - 2 ? .25 : 0;
  const w = Math.min(1, Math.max(0, (danger - .7) / .25));
  dx = dx * (1 - w) + cx * (1.3 * w + late); dy = dy * (1 - w) + cy * (1.3 * w + late);
  if (r.g) { if (b.gk !== r.g.id) { b.gk = r.g.id; b.gd = Math.random() < D.fd; } }
  if (r.g && b.gd) {
    const gx = Math.cos(r.g.ang), gy = Math.sin(r.g.ang), rx = b.x - r.g.hx, ry = b.y - r.g.hy, cr = rx * gy - ry * gx;
    if (rx * gx + ry * gy > 0 && Math.abs(cr) < GHW + 32) {
      let sx = gy, sy = -gx; if (sx * cx + sy * cy < 0 !== cr < 0) { sx = -sx; sy = -sy; }
      dx = sx + cx * .3; dy = sy + cy * .3;
    }
  }
  const j = (Math.random() - .5) * D.jt, sk = D.sk[0] + D.sk[1] * b.rk, c = Math.cos(j), s = Math.sin(j), l = Math.hypot(dx, dy) || 1;
  b.ix = (dx * c - dy * s) / l * sk; b.iy = (dx * s + dy * c) / l * sk;
  if (Math.random() < D.wd) { b.ix = Math.random() * 2 - 1; b.iy = Math.random() * 2 - 1; }
  b.fa = Math.atan2(b.iy, b.ix);
  if (r.st !== 'play') return;
  const d = Math.hypot(tgt.x - b.x, tgt.y - b.y), ta = Math.atan2(tgt.y - b.y, tgt.x - b.x);
  if (r.sk && b.scd <= 0 && d < 185 && Math.cos(ta - b.fa) > .5 && u < .72 && Math.random() < D.sp) { doSkill(r, b); return; }
  if (b.cd <= 0 && d > 55 && d < 230 && Math.cos(ta - b.fa) > .8 && u < .7 && edgeU(r, b.x + (b.vx + Math.cos(b.fa) * DASHV) * .6, b.y + (b.vy + Math.sin(b.fa) * DASHV) * .6) < .88 && Math.random() < D.dp) doDash(r, b);
  if (b.pcd <= 0 && b.par <= 0) for (const o of foes) {
    const dx = b.x - o.x, dy = b.y - o.y, od = Math.hypot(dx, dy) || 1, closing = ((o.vx - b.vx) * dx + (o.vy - b.vy) * dy) / od;
    if (od < D.pr && closing > 140 && Math.random() < D.pp) { doParry(r, b); break; }
  }
}
function startMatch(r) {
  r.players = r.players.filter(p => p.connected); r.players.forEach(p => { p.in = true; p.wait = false; p.score = 0; p.kills = 0; });
  r.ord = [0, 1, 2].sort(() => Math.random() - .5);
  r.round = 0; r.log = []; r.res = null; startRound(r);
}
function startRound(r) {
  r.round++; r.a = r.ord[(r.round - 1) % 3]; r.R = R0; r.g = null; r.gc = 0; r.gs = -1; r.gn = +process.env.GFIRST || GFIRST; r.kl = {}; r.prj = []; r.st = 'count'; r.tmr = 3; r.t = 0; r.ev = [];
  const ps = r.players.filter(p => p.in);
  ps.forEach((p, i) => {
    const a = i / ps.length * Math.PI * 2 + r.round * 0.7, d = R0 * 0.62;
    Object.assign(p, { x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, alive: true, cd: 0, pcd: 0, par: 0, stun: 0, scd: 0, skt: 0, skp: 0, inv: 0, slw: 0, skh: {}, ix: 0, iy: 0, lh: 0, lht: -99 });
    p.fa = Math.atan2(-p.y, -p.x);
  });
  all(r, info(r));
}
function snap(r) {
  const o = { t: 's', ts: Math.round(TICKN * DT * 1000), a: r.a, st: r.st, r: r.round, tm: Math.round((r.st === 'play' ? Math.max(0, ROUND - r.t) : r.tmr) * 10) / 10, R: Math.round(r.R * 10) / 10, g: r.g ? [+r.g.ang.toFixed(2), r.g.ph, +r.g.tm.toFixed(1), r.g.s] : 0,
    p: r.players.filter(p => p.in).map(p => [p.id, +p.x.toFixed(1), +p.y.toFixed(1), Math.round(p.vx), Math.round(p.vy), p.alive ? 1 : 0, +p.cd.toFixed(1), +p.fa.toFixed(2), +p.pcd.toFixed(1), p.par > 0 ? 1 : 0, p.stun > 0 ? 1 : 0, +p.scd.toFixed(1), (p.skt > 0 ? 1 : 0) | (p.inv > 0 ? 2 : 0) | (p.slw > 0 ? 4 : 0)]), ev: r.ev };
  if (r.prj && r.prj.length) o.prj = r.prj.map(q => [+q.x.toFixed(1), +q.y.toFixed(1), q.ci, +q.r.toFixed(0)]);
  all(r, o);
  r.ev = [];
}
function step(r) {
  const ps = r.players.filter(p => p.in && p.alive); r.t += DT;
  r.R = r.t < SHRINK_AT ? R0 : R0 - (R0 - RMIN) * Math.min(1, (r.t - SHRINK_AT) / SHRINK_LEN);
  const k = r.R / R0;
  if (ps.length) {
    if (!r.g) { if (r.t >= r.gn) {
        let s; do { s = Math.random() * 4 | 0; } while (s === r.gs); r.gs = s;
        const t = ps[Math.random() * ps.length | 0], ph = PORTS[s], hx = Math.cos(ph) * NZ[r.a][0], hy = Math.sin(ph) * NZ[r.a][1], inward = ph + Math.PI,
          d = Math.max(-GSWING, Math.min(GSWING, wrapA(Math.atan2(t.y - hy, t.x - hx) - inward) + (Math.random() - .5) * .3)), ang = inward + d;
        r.g = { s, ang, hx, hy, ph: 0, tm: GW, id: ++r.gc }; r.ev.push(['warn', +ang.toFixed(2), s]); } }
    else if ((r.g.tm -= DT) <= 0) { if (r.g.ph === 0) { r.g.ph = 1; r.g.tm = GD; r.ev.push(['gush', +r.g.ang.toFixed(2), r.g.s]); } else { r.g = null; r.gn = r.t + GI; } }
  } else if (r.g) r.g = null;
  for (const p of ps) if (p.bot) botThink(r, p, ps);
  for (const p of ps) {
    p.cd = Math.max(0, p.cd - DT); p.pcd = Math.max(0, p.pcd - DT); p.par = Math.max(0, p.par - DT); p.stun = Math.max(0, p.stun - DT);
    p.scd = Math.max(0, p.scd - DT); p.skt = Math.max(0, p.skt - DT); p.inv = Math.max(0, p.inv - DT); p.slw = Math.max(0, p.slw - DT);
    if (p.skp > 0 && (p.skp -= DT) <= 0) {
      p.skp = 0;
      if (p.ci === 0) skRad(r, p, 140, 440);
      else if (p.ci === 3) skRad(r, p, 130, 410);
      else if (p.ci === 12) skRad(r, p, 150, 470);
      else if (p.ci === 22) skRad(r, p, 155, 460, .4);
    }
    if (p.skt > 0 && [1, 4, 10, 16, 18, 20].includes(p.ci)) {
      for (const o of ps) if (o !== p && o.alive && r.t - (p.skh[o.id] || -9) > .28 && Math.hypot(o.x - p.x, o.y - p.y) < 72) {
        p.skh[o.id] = r.t; const dx = o.x - p.x, dy = o.y - p.y, l = Math.hypot(dx, dy) || 1;
        skHit(r, p, o, dx / l * 420, dy / l * 420, .25);
      }
    }
    const sf = (p.stun > 0 ? .3 : 1) * (p.slw > 0 ? .45 : 1), ix = p.connected ? p.ix * sf : 0, iy = p.connected ? p.iy * sf : 0;
    let gx = 0, gy = 0;
    if (r.g && r.g.ph === 1 && p.inv <= 0) { const dx = Math.cos(r.g.ang), dy = Math.sin(r.g.ang), rx = p.x - r.g.hx, ry = p.y - r.g.hy; if (rx * dx + ry * dy > 0 && Math.abs(rx * dy - ry * dx) < GHW) { gx = dx * GA; gy = dy * GA; } }
    const fr = p.skt > 0 && (p.ci === 1 || p.ci === 16) ? .98 : FR;
    p.vx = (p.vx + (ix * ACC + gx) * DT) * fr; p.vy = (p.vy + (iy * ACC + gy) * DT) * fr;
    const cap = p.slw > 0 ? VCAP * .55 : VCAP, s = Math.hypot(p.vx, p.vy); if (s > cap) { p.vx *= cap / s; p.vy *= cap / s; }
    p.x += p.vx * DT; p.y += p.vy * DT;
  }
  if (r.prj && r.prj.length) {
    for (let i = r.prj.length - 1; i >= 0; i--) {
      const q = r.prj[i]; q.x += q.vx * DT; q.y += q.vy * DT; q.t -= DT;
      const ow = r.players.find(p => p.id === q.ow);
      if (ow) for (const o of ps) if (o.id !== q.ow && o.alive && !q.hit[o.id] && Math.hypot(o.x - q.x, o.y - q.y) < q.r + SR) {
        q.hit[o.id] = 1; const dx = o.x - q.x, dy = o.y - q.y, l = Math.hypot(dx, dy) || 1;
        skHit(r, ow, o, (dx / l * .7 + q.vx / 520 * .3) * 560, (dy / l * .7 + q.vy / 520 * .3) * 560, .55);
      }
      if (q.t <= 0 || Math.hypot(q.x, q.y) > R0 * 1.4) r.prj.splice(i, 1);
    }
  }
  for (let i = 0; i < ps.length; i++) for (let k = i + 1; k < ps.length; k++) {
    const a = ps[i], b = ps[k]; let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d < 2 * SR) {
      if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
      const nx = dx / d, ny = dy / d, ov = (2 * SR - d) / 2;
      a.x += nx * ov; a.y += ny * ov; b.x -= nx * ov; b.y -= ny * ov;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel < 0) {
        const pa = a.par > 0, pb = b.par > 0;
        if (pa !== pb && -rel > 40) { (pa ? b : a).lh = (pa ? a : b).id; (pa ? b : a).lht = r.t; parryHit(r, pa ? a : b, pa ? b : a, pa ? [-nx, -ny] : [nx, ny], -rel); }
        else {
          const j = -(1 + 1.15) * rel / 2, ia = a.inv > 0 ? 0 : 1, ib = b.inv > 0 ? 0 : 1;
          a.vx += j * nx * ia; a.vy += j * ny * ia; b.vx -= j * nx * ib; b.vy -= j * ny * ib;
          if (-rel > KMIN) { if (ia) { a.lh = b.id; a.lht = r.t; } if (ib) { b.lh = a.id; b.lht = r.t; } }
          if (-rel > 60) r.ev.push(['hit', Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2), Math.round(-rel)]);
        }
      }
    }
  }
  for (const p of ps) if (OUT[r.a](p.x / k, p.y / k)) {
    p.alive = false; const kid = p.lh && p.lh !== p.id && r.t - p.lht <= KWIN && r.players.some(x => x.id === p.lh) ? p.lh : 0;
    if (kid) r.kl[kid] = (r.kl[kid] || 0) + 1;
    r.ev.push(['out', p.id, Math.round(p.x), Math.round(p.y), kid]);
  }
  const alive = ps.filter(p => p.alive), pts = {}; let winner = null, done = false, timeout = false;
  if (alive.length === 1) { winner = alive[0].id; pts[winner] = PT_WIN; done = true; }
  else if (alive.length === 0) done = true;
  else if (r.t >= ROUND) { alive.forEach(p => pts[p.id] = PT_SURV); done = true; timeout = true; }
  if (done) {
    r.g = null; r.prj = [];
    for (const p of r.players) { const kn = r.kl[p.id] || 0; p.score += (pts[p.id] || 0) + kn * PT_KILL; p.kills += kn; }
    r.log.push({ n: r.round, w: winner, pts, k: r.kl, to: timeout });
    r.st = 'end'; r.tmr = 4.5; snap(r); all(r, info(r));
  }
}
function finish(r) {
  const ps = r.players.filter(p => p.in), m = Math.max(...ps.map(p => p.score));
  r.res = { winners: ps.filter(p => p.score === m).map(p => p.id) }; r.st = 'final'; all(r, info(r));
}
function tick() {
  TICKN++;
  for (const [c, r] of rooms) {
    if (!r.players.some(p => p.connected && !p.bot)) { r.empty = r.empty || Date.now(); if (Date.now() - r.empty > 60000) rooms.delete(c); continue; }
    r.empty = 0;
    if (r.st === 'count') { r.tmr -= DT; if (r.tmr <= 0) { r.st = 'play'; r.t = 0; all(r, info(r)); } }
    else if (r.st === 'play') step(r);
    else if (r.st === 'end') { r.tmr -= DT; if (r.tmr <= 0) { if (r.round >= ROUNDS) finish(r); else startRound(r); } }
    if (['count', 'play', 'end'].includes(r.st)) snap(r);
  }
}
let last = Date.now(), acc = 0;
setInterval(() => { const n = Date.now(); acc += Math.min(.25, (n - last) / 1000); last = n; while (acc >= DT) { acc -= DT; tick(); } }, 8);

wss.on('connection', ws => {
  ws.live = true; ws.on('pong', () => ws.live = true);
  let room = null, pl = null;
  const attach = (r, p) => {
    room = r; pl = p; p.ws = ws; p.connected = true;
    if (!r.players.some(x => x.id === r.host && x.connected && !x.bot)) r.host = p.id;
    send(ws, { t: 'you', id: p.id, token: p.token, code: r.code }); all(r, info(r));
  };
  ws.on('message', d => {
    let m; try { m = JSON.parse(d); } catch { return; }
    if (m.t === 'emo') {
      const now = Date.now(); if (room && pl && Number.isInteger(m.i) && m.i >= 0 && m.i < NE && now >= (pl.eu || 0)) { pl.eu = now + EMO_CD; all(room, { t: 'emo', id: pl.id, i: m.i }); } return; }
    if (m.t === 'ping') return send(ws, { t: 'pong', c: m.c });
    if (m.t === 'create' && !room) {
      const r = { code: newCode(), players: [], host: null, st: 'lobby', round: 0, log: [], res: null, tmr: 0, t: 0, ev: [], k: 0, R: R0, a: 0, ord: [0, 1, 2], solo: false, df: cdf(m.df), sk: csk(m.sk), gc: 0, prj: [] };
      rooms.set(r.code, r); const p = mkp(r, m.name, ws, m.ci); r.players.push(p); attach(r, p);
      if (m.quick) { r.solo = true; for (let i = Math.min(MAXP - 1, Math.max(1, +m.bots || 3)); i > 0; i--) addBot(r); startMatch(r); }
    } else if (m.t === 'join' && !room) {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return send(ws, { t: 'err', m: 'Room not found', fatal: 1 });
      let p = m.token && r.players.find(x => x.token === m.token);
      if (p) { if (p.ws && p.ws !== ws && p.ws.readyState === 1) p.ws.close(); }
      else {
        if (r.players.length >= MAXP && r.st === 'lobby') { const b = r.players.filter(x => x.bot).pop(); if (b) r.players = r.players.filter(x => x !== b); }
        if (r.players.length >= MAXP) return send(ws, { t: 'err', m: 'Room is full', fatal: 1 }); p = mkp(r, m.name, ws, m.ci); r.players.push(p); }
      attach(r, p);
    } else if (!room) return;
    else if (m.t === 'start') {
      if (pl.id !== room.host || room.st !== 'lobby') return;
      const on = room.players.filter(p => p.connected);
      if (on.length < 2) return send(ws, { t: 'err', m: 'Need at least 2 players' });
      const nr = on.filter(p => !p.bot && p.id !== room.host && !p.ready);
      if (nr.length) return send(ws, { t: 'err', m: 'Waiting for ' + (nr.length === 1 ? nr[0].name : nr.length + ' players') + ' to get ready' });
      startMatch(room);
    } else if (m.t === 'addbot') {
      if (pl.id !== room.host || room.st !== 'lobby') return;
      if (room.players.length >= MAXP) return send(ws, { t: 'err', m: 'Room is full' });
      addBot(room); all(room, info(room));
    } else if (m.t === 'ready') {
      if (room.st !== 'lobby' || pl.id === room.host) return;
      const v = !!m.v; if (pl.ready === v) return; pl.ready = v; all(room, info(room));
    } else if (m.t === 'setdiff') {
      if (pl.id !== room.host || !['lobby', 'final'].includes(room.st) || cdf(m.df) !== m.df) return;
      room.df = m.df; all(room, info(room));
    } else if (m.t === 'setsk') {
      if (pl.id !== room.host || !['lobby', 'final'].includes(room.st) || (m.sk !== 0 && m.sk !== 1)) return;
      room.sk = m.sk; all(room, info(room));
    } else if (m.t === 'rmbot') {
      if (pl.id !== room.host || room.st !== 'lobby') return;
      const b = room.players.filter(x => x.bot).pop(); if (b) { room.players = room.players.filter(x => x !== b); all(room, info(room)); }
    } else if (m.t === 'leave') {
      const r = room, p = pl; room = pl = null; p.connected = false; p.ws = null;
      if (r.st === 'lobby') r.players = r.players.filter(x => x !== p);
      else if (p.in && p.alive) { p.alive = false; r.ev.push(['out', p.id, Math.round(p.x), Math.round(p.y)]); }
      if (r.host === p.id) { const n = r.players.find(x => x.connected && !x.bot); if (n) r.host = n.id; }
      if (!r.players.some(x => x.connected && !x.bot)) rooms.delete(r.code); else all(r, info(r));
    } else if (m.t === 'in') {
      let x = +m.x || 0, y = +m.y || 0; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      pl.ix = x; pl.iy = y; if (l > 0.2) pl.fa = Math.atan2(y, x);
    } else if (m.t === 'dash') {
      if (room.st !== 'play' || !pl.in || !pl.alive || pl.cd > 0) return;
      doDash(room, pl);
    } else if (m.t === 'parry') {
      if (room.st !== 'play' || !pl.in || !pl.alive || pl.pcd > 0 || pl.par > 0) return;
      doParry(room, pl);
    } else if (m.t === 'skill') {
      if (room.st !== 'play' || !room.sk || !pl.in || !pl.alive || pl.scd > 0 || pl.stun > 0) return;
      doSkill(room, pl);
    } else if (m.t === 'soap') {
      if (room.st !== 'lobby' || !Number.isInteger(m.ci) || m.ci < 0 || m.ci >= NS || m.ci === pl.ci) return;
      const o = room.players.find(x => x !== pl && x.ci === m.ci);
      if (o && !o.bot) return send(ws, { t: 'err', m: 'That soap is taken' });
      if (o) o.ci = pl.ci;
      pl.ci = m.ci; all(room, info(room));
    } else if (m.t === 'cheer') {
      const n = Date.now();
      if (!['play', 'end'].includes(room.st) || (pl.in && pl.alive && room.st === 'play') || n - (pl.cheerAt || 0) < 700) return;
      pl.cheerAt = n; room.ev.push(['cheer', pl.id]);
    } else if (m.t === 'again') {
      if (room.st !== 'final') return;
      room.players = room.players.filter(p => p.connected);
      room.players.forEach(p => { p.wait = false; p.in = false; p.score = 0; p.kills = 0; p.ready = false; });
      room.st = 'lobby'; room.round = 0; room.log = []; room.res = null;
      if (room.solo) startMatch(room); else all(room, info(room));
    }
  });
  ws.on('close', () => {
    if (!room || pl.ws !== ws) return;
    const r = room, p = pl; p.connected = false;
    if (r.host === p.id) { const n = r.players.find(x => x.connected && !x.bot); if (n) r.host = n.id; }
    if (r.st === 'lobby') setTimeout(() => {
      if (!p.connected && r.st === 'lobby' && r.players.includes(p)) { r.players = r.players.filter(x => x !== p); all(r, info(r)); }
    }, 8000);
    all(r, info(r));
  });
});
setInterval(() => wss.clients.forEach(c => { if (c.live === false) return c.terminate(); c.live = false; c.ping(); }), 25000);
srv.listen(PORT, '0.0.0.0', () => console.log('BUBBLE BRAWL (build char-skills-1) di port ' + PORT));
