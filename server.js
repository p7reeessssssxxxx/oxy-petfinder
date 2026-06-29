// oxy Pet Finder — shared sightings backend
// Tiny Express API. In-memory store with TTL (no DB needed; sightings are
// ephemeral). Deploy to Railway: see DEPLOY.md.
//
// Endpoints:
//   GET  /health                         -> { ok: true, count, uptime }
//   POST /report  { placeId, jobId, pet, players, maxPlayers }
//   GET  /finds?pets=Raccoon,Unicorn&max=8   -> [ {placeId, jobId, pet, players, maxPlayers, age}, ... ]
//
// Auth: every request must send header  x-oxy-key: <OXY_KEY>  matching the
// OXY_KEY env var. If OXY_KEY is unset, auth is disabled (open) — set it.

const express = require("express");
const app = express();
app.use(express.json({ limit: "16kb" }));

const PORT = process.env.PORT || 3000;
const OXY_KEY = process.env.OXY_KEY || "";
const TTL_MS = (parseInt(process.env.SIGHTING_TTL_SEC || "150", 10)) * 1000; // pets despawn fast
const MAX_ENTRIES = 5000;
const START = Date.now();

// key: jobId|normalizedPet -> sighting
const store = new Map();
const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of store) if (v.ts < cutoff) store.delete(k);
}
setInterval(prune, 30 * 1000).unref();

// Auth middleware
app.use((req, res, next) => {
  if (!OXY_KEY) return next();
  if (req.get("x-oxy-key") === OXY_KEY) return next();
  return res.status(401).json({ error: "bad key" });
});

app.get("/health", (req, res) => {
  prune();
  res.json({ ok: true, count: store.size, uptime: Math.floor((Date.now() - START) / 1000) });
});

app.post("/report", (req, res) => {
  const b = req.body || {};
  const placeId = Number(b.placeId);
  const jobId = String(b.jobId || "");
  const pet = String(b.pet || "");
  if (!placeId || !jobId || !pet) return res.status(400).json({ error: "missing placeId/jobId/pet" });

  const key = jobId + "|" + norm(pet);
  store.set(key, {
    placeId,
    jobId,
    pet,
    players: Number(b.players) || 0,
    maxPlayers: Number(b.maxPlayers) || 0,
    ts: Date.now(),
  });

  // hard cap: drop oldest if we somehow blow past MAX_ENTRIES
  if (store.size > MAX_ENTRIES) {
    let oldestK = null, oldestT = Infinity;
    for (const [k, v] of store) if (v.ts < oldestT) { oldestT = v.ts; oldestK = k; }
    if (oldestK) store.delete(oldestK);
  }
  res.json({ ok: true });
});

app.get("/finds", (req, res) => {
  prune();
  const wanted = String(req.query.pets || "")
    .split(",")
    .map((s) => norm(decodeURIComponent(s)))
    .filter(Boolean);
  const wantSet = new Set(wanted);
  const max = Math.min(parseInt(req.query.max || "20", 10) || 20, 100);

  const now = Date.now();
  const out = [];
  for (const v of store.values()) {
    if (wantSet.size && !wantSet.has(norm(v.pet))) continue;
    out.push({
      placeId: v.placeId,
      jobId: v.jobId,
      pet: v.pet,
      players: v.players,
      maxPlayers: v.maxPlayers,
      age: Math.floor((now - v.ts) / 1000), // seconds since reported
    });
  }
  // freshest first, then emptier servers first (easier to slip in)
  out.sort((a, b) => (a.age - b.age) || (a.players - b.players));
  res.json(out.slice(0, max));
});

app.listen(PORT, () => console.log("oxy pet-finder backend on :" + PORT + (OXY_KEY ? " (auth on)" : " (OPEN — set OXY_KEY!)")));
