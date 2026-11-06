# Changelog

All notable changes to Bubble Brawl.

## Current Build: lobby-ready-1

### Features

- **2 more soap looks (24-25)** — Tojilather (scarred mercenary, dark staff-blade) and Mahorasuds (pale divine general, golden wheel halo, jagged sword). `NS = 26`; out-of-range test now uses index 26.
- **3 more soap looks (21-23)** — Scarlather (red scarf scout), Itadorinse (pink spiky hair, hooded uniform) and Bambubble (bamboo muzzle, ombre hair, pink kimono). `NS = 24`; out-of-range test now uses index 24.
- **3 new soap looks (18-20)** — Captain Scrub (green cloak, wings crest, twin blades), Limitless Lather (blindfold, white spikes, purple orb) and Checkerlather (checkered haori, scar, hanafuda earrings, black blade). Punny original soap-bar homages in the same hand-drawn style as the rest. The server now accepts soap indexes 0-20 (`NS = 21`), the picker, the stand crowd and the lobby avatars pick them up automatically; tests updated (index 21 is the first out-of-range one).
- **Emotes** — 7 meme stickers (Muach, Shhh, Stare, MDR, AAAA, Bleh, Haha) shown in a speech bubble above the soap for ~2 s. Keys **1-7** on a laptop, the 😀 button above Dash on a phone. Client cooldown 2 s, server cooldown 1.5 s per player. Bots taunt now and then. Assets live in `client/emotes/` as animated WebP (96 px, ~300 KB total, original frame timing). They are DOM `<img>` overlays because canvas `drawImage` would freeze animated images on one frame.
- **Protocol (emotes)** — client `emo {i}` (0-6), server relays `emo {id, i}` to the whole room; invalid index, no room or cooldown = ignored. Test: `tests/test-emote.js`.
- **Ready check for guests** — in a friends room every player except the host gets an **I'm ready!** button in the lobby (tap again to take it back). The host's **Start!** stays disabled until all guests are ready, and the note under the player list says who is still missing. Each guest's chip shows a *Ready* or *Not ready* badge. The host never needs to be ready, bots are always ready, guests who are offline do not block the start, and Quick Play is unchanged. After a match everybody has to get ready again, and a guest who joins late starts as not ready. If a new player becomes host they count as ready.
- **Protocol** — new message `ready {v}` (1 = ready, 0 = not ready; lobby only, ignored for the host), `players[].rd` in the room info (1 for the host, bots and ready guests), `start` is refused with `Waiting for <name> to get ready` while a connected guest is not ready, and the server reports the `ready` feature. An older server sends no `rd`: the client then hides the button and never blocks Start.

### Tests

- New `test-ready.js` (start gate, taking ready back, host and bots always ready, offline guests do not block, no change during a match, reset after a match and for late joiners, new host, Quick Play). The other multiplayer tests now ready their guest before the host starts.

### Previous build: bot-difficulty-1

### Features

- **Bot difficulty: Easy / Normal / Hard** — the bots were too sharp for most players, so every room now has a difficulty. **Hard is the old bot, unchanged.** **Normal** (the new default) thinks slower, aims worse, dashes and parries less often and does not always dodge the faucet. **Easy** is slow and clumsy: long reaction time, wobbly aim, rarely dashes, almost never parries, often ignores the faucet stripe and drifts close to the rim before turning back. The pick is made on the home screen (used by Quick Play and by new rooms), by the host in the lobby, or after a match before the rematch; it is remembered on the device. Bots read the level on every decision, so a change in the lobby applies at once. It cannot be changed in the middle of a match.
- **Protocol** — `create` accepts `df` (0 easy, 1 normal, 2 hard; anything else means normal), new host-only message `setdiff {df}` (lobby and after a match), `room.df` in the room info, and the server reports the `difficulty` feature. An old client that sends no `df` gets Normal; an old server sends no `df` and the client shows Normal.

### Tests

- New `test-difficulty.js` (start values, invalid values, host-only changes, no change mid-match, change before a rematch, every level plays). `bench-bots.js` now plays a scripted casual player against every level and prints a table (player win rate, round win rate, points, bot dashes and parries).

### Previous build: kills-faucet-always-1

### Features

- **Two new soaps (18 in total)** — *Bubblefin* (16): a little goldfish kid with orange hair and fin tufts, a red dress with a scalloped hem, little side fins and floating bubbles. *Bobbie* (17): a rosy-cheeked kid with a blunt black bob, a red ribbon, a hair flower and a mint pinafore with a pocket. Both have slim, rounded soap-bar bodies (no neck, no feet) so they read as soap, not dolls. Original designs, cosmetic only. `NS` is 18 on server and client, the picker shows 18 tiles, the server reports the `soap18` feature, and `test-parry.js` now checks that 17 is valid and 18 is out of range.
- **Action button icons centred** — the icon inside the Dash/Parry/Cheer bubble buttons used to sit up to 11 px left of centre; the icon box now has a fixed size and centres its SVG.
- **New action buttons** — Parry (teal shield), Dash (orange chevrons) and Cheer (pink star) are icon-only bubble buttons now. The cooldown is a ring that fills clockwise with the seconds left in the middle; the button presses down when tapped. Cheer hops gently while you are out.
- **New favicon** — two soap bars bonking inside a burst of bubbles (SVG, ICO, 32/192 PNG and the Apple touch icon).
- **Boss Crab redesign** — one giant claw, a small one, uneven eye stalks, angry brows, a tiny gold crown and bubble-dot swim trunks. Original design, cosmetic only.

- **Kill points** — every knock-out now scores +1 on top of the round points (win 3, time-out survivor 1). The last rival you bumped (hit harder than 40 px/s, or a parry rebound) within 3 seconds before they fall is credited to you. Falling alone, faucet-only pushes and leaving the room give no kill. Kills count in draw rounds too. The round-end screen lists each player's points (win / survived / kills), the scoreboard shows total kills, and a "+1 KILL!" popup appears where the soap fell. `log[].k` = kills per player in that round, `players[].kl` = total kills; the `out` event gets the killer id as 5th value. Round-win rules are unchanged.
- **Faucet is much more active** — first warning at 4 s (was 8 s) and a 4 s gap between gushes (was 10 s): about 7 gushes per round instead of 1.
- **No more stray mouths** — soaps that have no mouth (fish, duck, whale, Lather Knight, Lord Lather, Bleep-Bar, Grumpus) used to get a fallback mouth when they were hit ("o") or cheering in the stand, drawn in the middle of their body. Now they never get one and show feelings with their eyes only. One shared `mouth()` draws the mouth for the game and the stand. For the soaps that do have a mouth, the open mouth was moved clear of their details (Hole's bottom edge, Skylather's chin and tunic, Squarepore's teeth, Star Buddy's shorts) with the optional `o:[x,y,scale]` in the soap data; Star Buddy's smile sits a little higher.
- **Readable names on dark soaps** — Lord Lather's colour is charcoal, so the brown name text vanished on his scoreboard pill, round-end rows and lobby chip. A small `ink()` helper now picks light text on dark soap colours and the usual brown on the rest (only Lord Lather is dark enough to switch). The crown/bot icons in the lobby chip follow the text colour.
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

