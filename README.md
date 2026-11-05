# Bubble Brawl

Online multiplayer party game for 2–8 players. Slide your soap bar around a sink, toilet or bathtub and bonk rivals off the edge. Win rounds and score kills; the highest total after 3 rounds wins!

## Features

- **Emotes**: press 1-7 (or the 😀 button on phones) to pop a meme sticker over your soap.

- **3 arenas** — Sink (circle), Toilet (oval), Bathtub (rounded rectangle) — shuffled each round
- **18 soap looks** — cosmetic only; each player picks their own
- **Dash & Parry** — dash to ram, parry to reflect incoming hits
- **Bots with 3 difficulty levels** — Easy, Normal or Hard. Quick Play starts instantly against bots; add bots to private rooms too. Pick the level on the home screen, in the lobby (host) or after a match
- **Ready check** — in a friends room every guest taps *I'm ready* in the lobby; the host can only start once all of them are ready (bots are always ready)
- **Spectator stand** — eliminated players cheer from the "SOAP FANS" stand
- **Scoring** — 3 points for winning a round, +1 point for every kill (the last rival you bumped before they fell), 1 point for each survivor on a time-out
- **Faucet gush** — a living faucet that spits a water jet in all three arenas, every few seconds, even while the arena shrinks
- **Procedural music** — funky party synth, no audio files needed

## Folder Structure

```
bubble-brawl/
├── server/              # Node.js game server (authoritative)
│   ├── server.js        # Game logic, physics, WebSocket handling
│   ├── package.json
│   └── tests/           # Automated tests & benchmarks (incl. test-score.js for kill points, test-difficulty.js for bot difficulty, test-ready.js for the lobby ready check)
├── client/              # Static frontend (single HTML page)
│   ├── index.html       # Game UI, rendering, controls, audio
│   ├── config.js        # Server URL configuration
│   └── *.png/ico/svg    # Favicons and icons
├── docs/                # Documentation
│   ├── CHANGELOG.md
│   └── DECISIONS.md
├── vercel.json          # Vercel deployment config
└── README.md
```

## Run Locally

```bash
cd server
npm ci
npm start          # http://localhost:3000
```

Open two browser windows (normal + incognito), create a room in one and join with the code in the other.

For single-service mode (server serves the frontend too), copy `client/index.html` into `server/public/index.html` and leave `BRAWL_SERVER` empty in `config.js`.

### Tests

```bash
cd server
npm test                     # runs all test suites
npm run bench:bots           # how a scripted casual player fares against each bot difficulty (~3 min)
```

## Deploy

### Backend → Render

The server needs a Node.js host with WebSocket support.

1. New Web Service on [Render](https://render.com)
2. Pick this repo → Root Directory: `server`
3. Build Command: `npm ci`
4. Start Command: `npm start`
5. Health Check Path: `/health`

Copy the service URL (e.g. `https://bubble-brawl.onrender.com`).

### Frontend → Vercel

1. Add New Project on [Vercel](https://vercel.com)
2. Pick this repo → Framework Preset: `Other`
3. Root Directory: leave empty (repo root)
4. `vercel.json` is already configured to output `client/`
5. Set the Render URL in `client/config.js`:
   ```js
   window.BRAWL_SERVER = "https://bubble-brawl.onrender.com";
   ```

## Limitations

- **No full client-side prediction** — only ~100 ms interpolation + own-soap prediction. Movement feels slightly delayed at high ping.
- **Room state is in memory** — a server restart drops all active rooms.
- **Free-tier cold starts** — Render free tier sleeps after inactivity; first connection can take ~1 minute.
