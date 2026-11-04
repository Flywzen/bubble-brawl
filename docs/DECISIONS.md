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
| **Scoring: 3 / 1 / 0** | Last standing = 3 pts, timeout survivors = 1 pt each, simultaneous elimination = 0. Simple, rewards aggressive play. |
| **Parry mechanic** | 0.3s active window. Successful parry: attacker is reflected at 1.25× speed, stunned for 0.9s, parrier gets 2s cooldown. Missed parry: 4s cooldown. Risk/reward trade-off. |
| **Faucet gush (sink only)** | Environmental hazard. Warning stripe (1.2s) then push (1.5s). Disabled once shrinking starts to avoid unfair late-game combos. |
| **8 cosmetic soap shapes** | Purely visual differentiation. All soaps have the same hitbox (radius 22). |

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

