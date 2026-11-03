# BUBBLE BRAWL
Online multiplayer game for 2-8 players: soap bars bump each other off a sink, toilet or bathtub (the arena is shuffled each round; each arena has its own collision shape: circle, oval, rounded rectangle). Every player colour has its own cute soap-bar shape: one with a hole in the middle, fish, duck, frog, star, cat, whale and heart. Node server is authoritative (physics at 30 Hz, snapshots at 30 Hz) over WebSocket (`ws`). One service serves both frontend and backend.

Spectators: everyone sits in ONE small stand ("SOAP FANS"), to the right of the arena in landscape or above it in portrait, so players are not distracted. The fans are soap-bar characters with eyes and waving arms. Players who are out (or waiting for the next round) take a front-row seat as their own soap and can press CHEER (Space/E/button), sent through the server with a 0.7 s cooldown. The rest of the background is intentionally plain.

Sink faucet gush: starting at 8 s, then every ~10 s, the faucet aims a water jet at a random player. A white dashed stripe warns for 1.2 s, then the jet pushes everything inside the stripe for 1.5 s (dodge sideways). Server-side in `step()`, sent in snapshots as `g:[angle,phase,timeLeft]` plus `warn`/`gush` events. `GFIRST=<seconds>` env var changes the first gush time (testing only).

## Bots and Quick Play
A bot is a normal player object (`bot:true`, no socket) driven by `botThink()` inside `step()` with the same inputs as a human (move, dash, burst). Messages: `create` with `quick:1,bots:3` (Quick Play: bots fill the room and the match starts at once, room is `solo`, "again" restarts immediately), `addbot` / `rmbot` (host, lobby only, max 8 players in total), `leave` (Back button: removes the player from a lobby, counts as falling out mid-round, hands the host role to another human, deletes the room when no human is left). Bots never become host and never keep a room alive. A human joining a full lobby takes a bot's seat. Bots look ahead at their own momentum to avoid the edge, aim to hit foes from the centre side so they get pushed outwards, dodge the faucet stripe, and have reaction delay and some randomness so they stay beatable.

## Run locally
    npm ci && npm start        # http://localhost:3000
    npm test                   # automated test with 2+ WebSocket clients (FAST=10 speeds up rounds)
Open two windows (normal + incognito), create a room in one and join with the code in the other.

## Deploy (backend only; the game page is hosted separately)
This folder is the realtime server. It needs a Node host with WebSocket support (not static hosting). On Render: New Web Service -> pick this GitHub repo -> Root Directory `1-backend`, Build `npm ci`, Start `npm start`, Health Check `/health`, plan Free, region Singapore. The service URL (`https://<name>.onrender.com`) goes into `../2-frontend/config.js`. If `public/index.html` is placed next to `server.js`, the server also serves the game page itself (single-service mode, leave `BRAWL_SERVER` empty then).

## Limitations
No client-side prediction yet (only ~100 ms interpolation), so movement feels slightly delayed at high ping. Room state is in memory: a server restart drops all rooms. Not yet tested on real devices.
