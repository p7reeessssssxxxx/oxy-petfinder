# oxy Pet Finder — backend deploy (Railway)

A tiny API that collects rare wild-pet sightings from everyone running the hub
and serves them back so hunters can join the right server. ~5 minutes, free tier.

## What it does
- Clients **POST** `/report` when they see a rare pet in their server.
- Hunters **GET** `/finds?pets=Raccoon,Unicorn` and join the returned JobId.
- Sightings auto-expire after `SIGHTING_TTL_SEC` (default 150s) — wild pets
  despawn fast, so old logs are useless and get pruned automatically.

## Deploy on Railway
1. Go to https://railway.app and sign in (GitHub login is easiest).
2. **New Project → Deploy from GitHub repo** (push this `petfinder-backend`
   folder to a repo first), **or** **New Project → Empty Service** then drag the
   folder in via the Railway CLI (`railway up`).
3. Railway auto-detects Node and runs `npm start`. No build config needed.
4. Open the service → **Variables** and add:
   - `OXY_KEY` = any long random string (e.g. `oxy_9fkQ2...`). **Required** — this
     is the shared password. Anyone with it can read/write the network.
   - `SIGHTING_TTL_SEC` = `150` (optional; how long a sighting stays "fresh").
5. Service → **Settings → Networking → Generate Domain**. Copy the URL, e.g.
   `https://oxy-petfinder-production.up.railway.app`.

## Wire it into the hub
In `oxy gag2.lua`, near the top, set:
```lua
local PETFINDER_URL = "https://YOUR-APP.up.railway.app"  -- no trailing slash
local PETFINDER_KEY = "the same OXY_KEY you set on Railway"
```
(Or set `getgenv().oxy_PETFINDER_URL` / `oxy_PETFINDER_KEY` before loading the
hub if you'd rather not edit the file.)

Leave them blank and the Pet Finder still works **locally** (hop + scan), just
without the shared logs.

## Test
- Open `https://YOUR-APP.up.railway.app/health` in a browser — you should get
  `{"ok":true,...}` **only** if `OXY_KEY` is unset; with a key set you'll get
  `bad key` from the browser (no header), which is expected. Use the hub's
  **Test Connection** button instead — it sends the key.

## Reality check
The shared network only beats plain server-hopping if **several people run it
live at once** and you join fast (sightings are seconds-fresh). With just you
online, the local hop+scan fallback is doing all the work — that's fine, it
still finds pets, just without the head start from others' logs.
