# Bubble Brawl

Online multiplayer party game for 2–8 players. Slide your soap bar around a sink, toilet or bathtub and bonk rivals off the edge. Last soap standing wins!

## Features

- **3 arenas** — Sink (circle), Toilet (oval), Bathtub (rounded rectangle) — shuffled each round
- **8 soap shapes** — cosmetic only; each player picks their own
- **Dash & Parry** — dash to ram, parry to reflect incoming hits
- **Bots** — Quick Play starts instantly against bots; add bots to private rooms too
- **Spectator stand** — eliminated players cheer from the "SOAP FANS" stand
- **Faucet gush** — water jet hazard on the sink arena
- **Procedural music** — funky party synth, no audio files needed

## Folder Structure

```
bubble-brawl/
├── server/              # Node.js game server (authoritative)
│   ├── server.js        # Game logic, physics, WebSocket handling
│   ├── package.json
│   └── tests/           # Automated tests & benchmarks
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
npm run bench:bots           # bot performance benchmark (~2.5 min)
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
