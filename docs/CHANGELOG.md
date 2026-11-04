# Changelog

All notable changes to Bubble Brawl.

## Current Build: parry-soap-bots-1

### Features

- **Parry mechanic** — Tap parry right before a rival rams you. Active window of 0.3s; on success the attacker is thrown back harder and gets dizzy (weak steering for 0.9s). Cooldown: 4s on miss, 2s on success.
- **Soap selection** — 8 unique soap-bar shapes (hole, fish, duck, frog, star, cat, whale, heart), one per player colour. Cosmetic only. Players can pick/swap in the lobby; bots swap if a human wants their shape.
- **Bots and Quick Play** — Bot AI with move, dash, and parry, reaction delay, edge avoidance, and faucet dodging. Quick Play starts immediately with 3 bots, no invite needed. Bots fill empty seats in friend lobbies.
- **Sink faucet gush** — On the sink arena, a water jet targets a random player every ~10s (first at 8s). White dashed stripe warns for 1.2s, then the jet pushes for 1.5s. Shuts off when the arena starts shrinking.
- **Simulation clock and jitter-free snapshots** — Snapshots carry `ts = TICKN * DT * 1000`. Clients use min-delay tracking to schedule smooth playback regardless of network jitter.
- **Procedural music** — Funky party synth generated in the browser via Web Audio API. Four-bar chord progression with melody, bass, kick, clap, hi-hat. Intensity increases when the arena shrinks or time is low.
- **Spectator stand** — Eliminated and waiting players sit in a "SOAP FANS" stand and can cheer (Space/E, 0.7s cooldown).
- **Three arenas** — Sink (circle), toilet (oval), bathtub (rounded rectangle). Shuffled each round. Each has its own collision shape and visual theme.
- **WebSocket reconnect** — Automatic reconnect on drop. Dead-socket detection (6s no traffic). Visibility and online event listeners. Token-based session restore.

### Bug Fixes

- Fix `BRAWL_SERVER` URL syntax error in config.js and server.
- Server log now includes build version string.

### Tests

- Core multiplayer test: room creation, joining, host privileges, 3-round match, reconnect, mid-game join, dash/parry cooldowns, host handoff.
- Faucet test: validates gush timing relative to arena shrink with `GFIRST` env var.
- Bot test: Quick Play lifecycle, bot actions, leave/rejoin, host handoff, lobby bot management.
- Parry test: soap selection, parry reflection, stun, cooldown timing.
- Bot benchmark: 6 Quick Play games at normal speed, reports win/timeout/draw distribution.

### Infrastructure

- Migrated from Netlify to Vercel for frontend hosting.
- Single-service mode: server can serve the game page directly when `public/index.html` exists.
- Restructured repo: `1-backend/` → `server/`, `2-frontend/` → `client/`, tests moved to `server/tests/`, docs to `docs/`.

## Initial Release

- Initial upload of Bubble Brawl multiplayer game.

