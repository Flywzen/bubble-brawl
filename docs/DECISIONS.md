# Architecture & Design Decisions

Key decisions made during development, with rationale.

## Networking

| Decision | Detail |
|---|---|
| **Server-authoritative physics** | All game physics run on the server at 30 Hz. Clients are dumb renderers. Prevents cheating since the server owns all positions, velocities, and collisions. |
| **WebSocket (`ws` library)** | Real-time bidirectional communication. The `ws` npm package is used for its minimal footprint and Node.js native performance. |
| **Snapshot rate = physics rate (30 Hz)** | Every physics tick produces a snapshot. Keeps client rendering smooth without extrapolation complexity. |
| **Jitter-free playback via server timestamps** | Snapshots carry `ts = TICKN * DT * 1000`. The client tracks minimum one-way delay and uses it to schedule smooth playback regardless of network jitter. |
| **Dead-socket detection (6s timeout)** | Phones that lock the screen or lose signal keep a dead socket open for minutes. Client-side polling closes stale connections and reconnects. |
| **Token-based reconnect** | Each player gets a unique token on join. Refreshing the page or reconnecting with the same token restores the same seat mid-match. |

## Gameplay

| Decision | Detail |
|---|---|
| **3 arenas, shuffled per round** | Sink (circle), toilet (oval), bathtub (rounded rect). Variety without complexity. Each arena has a distinct collision boundary function (`OUT[]`). |
| **Arena shrinks after 15s** | Forces engagement. R0 (300) shrinks to RMIN (130) over 20s. Rounds cap at 45s. |
| **Scoring: round win + kills** | Round win (last standing) = 3 pts, timeout survivors = 1 pt each, simultaneous elimination = 0 win points. On top of that every kill = +1 pt (`PT_KILL`), so a round won by knocking the last rival out is worth 4. The match winner is whoever has the most points after 3 rounds (a tie is a shared win). Constants `PT_WIN`, `PT_SURV`, `PT_KILL` are at the top of `server.js`. |
| **Kill credit = last bump** | Every collision harder than `KMIN` (40 px/s closing speed) records who bumped whom (`lh`, `lht`). A parry rebound counts as the parrier bumping the attacker. When a soap goes out and was bumped within `KWIN` (3 s), the last one to bump it gets the kill, even if that soap falls later in the same round. Falling alone, being pushed out by the faucet only, or leaving the room gives nobody a kill (the `out` event carries the killer id as its 5th value, 0 = none). Kills count in a draw round too. |
| **Parry mechanic** | 0.3s active window. Successful parry: attacker is reflected at 1.25× speed, stunned for 0.9s, parrier gets 2s cooldown. Missed parry: 4s cooldown. Risk/reward trade-off. |
| **Faucet gush (all 3 arenas)** | Environmental hazard. Warning stripe (1.2s) then push (1.5s), then a 4 s gap (`GI`), first warning at 4 s (`GFIRST`): about one gush every 6.7 s, so ~7 per round. It also keeps working while the arena shrinks (it used to switch off at 15 s, which meant a single gush per round); the nozzle table stays fixed on the rim, the jet simply runs over the smaller water. The faucet is a snake: it comes out of one of 4 rim ports and the jet starts at its head, 87 px inside the water edge of that port (nozzle at 235 px on the sink, 205/220 px on the toilet's x/y axes, 235/160 px on the bathtub's), so the stripe always shows exactly where the push will be. The same timing, push and width apply in every arena; the server keeps a per-arena nozzle table (NZ). |
| **18 cosmetic soap looks** | Purely visual differentiation (index 0-17, one per player; the server only validates the range via `NS`). All soaps have the same hitbox (radius 22). The themed ones are original designs inspired by a space-fantasy and a seaside cartoon cast, not copies. Bubblefin (16) and Bobbie (17) are original storybook-style kids, not copies of any existing character. |

## Bots

| Decision | Detail |
|---|---|
| **Same input model as humans** | `ix`, `iy`, `dash`, `parry` — no special physics. Makes them fair and testable. |
| **Reaction delay + randomness** | 0.14–0.26s think interval, 80–100% skill factor, 4% random wander chance. Keeps bots beatable. |
| **Bots never become host, never keep rooms alive** | Simplifies room lifecycle. Last human leaving deletes the room. |
| **Quick Play = solo room with bots** | No matchmaking needed. Instant gameplay for solo users. |

## Deployment

| Decision | Detail |
|---|---|
| **Backend on Render, frontend on Vercel** | Render supports WebSocket + long-running Node.js. Vercel is free static hosting with good CDN. |
| **Single-service mode** | If `public/index.html` exists next to `server.js`, the server serves the game page too. Simplifies local dev and single-host deploys. |
| **Room state in memory only** | No database. Server restart drops all rooms. Acceptable for a casual game; avoids persistence complexity. |

## Client Rendering

| Decision | Detail |
|---|---|
| **Canvas 2D, single HTML file, zero deps** | Inline CSS + JS. No framework, no build step. Fast load, trivial deployment. |
| **Client-side prediction for own soap only** | Steering feels instant. Other players are interpolated from snapshots. Prediction is eased toward the server truth to hide corrections. |
| **Procedural music via Web Audio API** | No audio files to load. Four-bar loop with tempo/intensity tied to game state. |
| **Single spectator stand** | All spectators in one spot. Avoids visual clutter. Cheering adds energy without distraction. |

