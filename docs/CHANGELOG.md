# Changelog

All notable changes to Bubble Brawl.

## Current Build: kills-faucet-always-1

### Features

- **Kill points** — every knock-out now scores +1 on top of the round points (win 3, time-out survivor 1). The last rival you bumped (hit harder than 40 px/s, or a parry rebound) within 3 seconds before they fall is credited to you. Falling alone, faucet-only pushes and leaving the room give no kill. Kills count in draw rounds too. The round-end screen lists each player's points (win / survived / kills), the scoreboard shows total kills, and a "+1 KILL!" popup appears where the soap fell. `log[].k` = kills per player in that round, `players[].kl` = total kills; the `out` event gets the killer id as 5th value. Round-win rules are unchanged.
- **Faucet is much more active** — first warning at 4 s (was 8 s) and a 4 s gap between gushes (was 10 s): about 7 gushes per round instead of 1.
- **No more stray mouths** — soaps that have no mouth (fish, duck, whale, Lather Knight, Lord Lather, Bleep-Bar, Grumpus) used to get a fallback mouth when they were hit ("o") or cheering in the stand, drawn in the middle of their body. Now they never get one and show feelings with their eyes only. One shared `mouth()` draws the mouth for the game and the stand. For the soaps that do have a mouth, the open mouth was moved clear of their details (Hole's bottom edge, Skylather's chin and tunic, Squarepore's teeth, Star Buddy's shorts) with the optional `o:[x,y,scale]` in the soap data; Star Buddy's smile sits a little higher.
- **Faucet also works while the arena shrinks** — it no longer switches off at 15 s; a gush in progress is not cut when the shrink begins, and the snake no longer naps. Bots dodge the stripe the whole round.

### Tests

- New `test-score.js` (win + kill points, killer id in the `out` event, no kill for a soap that walks off alone). `test-faucet.js` rewritten for the new rule (fires after the shrink began, ≥3 warnings per round with the default timing). Test-only env `GA=0` switches the jet's push off.

### Previous build: snake-faucet-soaps-16

### Features

- **Faucet in the bathtub and the toilet too** — the living faucet is no longer sink-only. In every arena it hangs from a tap bar on the top rim, the other three rim ports get chrome hole plates, and it slithers out of a random port to warn (stripe) and spit the jet before the arena starts shrinking. The nozzle sits 87 px inside the water edge of the chosen port (sink 235/235, toilet 205/220, bathtub 235/160 px from the centre on x/y). Timing, push strength and hit width are the same as in the sink; bots dodge the stripe in every arena. `test-faucet.js` now checks all three arenas.
- **Galaxy crew reworked (still 16 soaps)** — Mini Mossy is gone. *Skylather* (young blade-wielding hero: swept brown hair, scar, dark tunic, blue foam blade) joins Lather Knight and Lord Lather, and *Bleep-Bar* is redrawn as a chibi astromech droid (white dome with blue panels, camera eye with a red light, chest panel, side legs and feet). *Lord Lather* is redrawn as a chibi dark-armor villain (dark glossy dome helmet with a crest, angry brows, red eyes, faceplate with nose and grille, chest panel with lights, wide cape; the soap colour is now charcoal). Order is Knight 8, Lord 9, Skylather 10, Bleep-Bar 11, reef crew back at 12-15. Cosmetic only.
- **Realistic faucet jet** — the water jet is redrawn from scratch. It leaves the nozzle as a thin stream, fans out into a cone (110 px) and then runs on as a lane of churned water up to 900 px. It has a bright core that thins with distance, flowing streaks, foam rings along the edges, spray droplets flung sideways, mist at the nozzle and a splash at the front. When it starts the water shoots out and travels along the lane; when the faucet stops the tail leaves the nozzle instead of vanishing at once. The warning stripe uses the same cone shape and the head shakes while spitting. Visual only: timing, push strength and the 38 px hit width are unchanged.
- **Living snake faucet** — the sink faucet is now a creature with eyes. A flexible chrome neck slithers out of one of 4 rim ports (top, right, bottom, left; never the same port twice in a row), the head glares at the chosen victim (angry eyes while warning, squinting while spitting) and the jet starts from the head's nozzle. Snapshot `g` is now `[angle, phase, timer, port]`; the angle uses the normal `(cos, sin)` convention and always points into the arena (max 63 degrees off straight-at-centre). At rest the head hangs from the tap bar in the sink and bathtub, blinks, follows the nearest soap and sleeps ("z") once the arena shrinks. Bots dodge the new jet geometry.
- **8 new soaps (16 total)** — *galaxy crew*: Lather Knight (hooded robe + foam blade), Lord Lather (masked helmet + red blade), Bleep-Bar (dome droid), Mini Mossy (long-eared sage). *Reef crew*: Squarepore (square sponge), Star Buddy (shorts-wearing starfish), Grumpus (sleepy-eyed long nose), Boss Crab (claws, eye stalks). Original designs, cosmetic only. Bots now pick random free soaps. The picker shows the selected soap's name.

### Previous build: parry-soap-bots-1

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

