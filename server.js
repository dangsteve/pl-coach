const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// DB setup (SQLite file)
const db = new sqlite3.Database("./coach.db");

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS states (" +
      "user_id TEXT PRIMARY KEY," +
      "state_json TEXT NOT NULL," +
      "updated_at TEXT NOT NULL" +
    ")"
  );
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve frontend from /public
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Get state for a user
app.get("/api/state/:userId", (req, res) => {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ error: "missing_user_id" });
  }

  db.get(
    "SELECT state_json FROM states WHERE user_id = ?",
    [userId],
    (err, row) => {
      if (err) {
        console.error("DB error", err);
        return res.status(500).json({ error: "db_error" });
      }
      if (!row) {
        return res.json({ state: null }); // no state yet
      }
      try {
        const state = JSON.parse(row.state_json);
        res.json({ state });
      } catch (e) {
        console.error("JSON parse error", e);
        res.status(500).json({ error: "bad_state_json" });
      }
    }
  );
});

// Save state for a user
app.post("/api/state/:userId", (req, res) => {
  const userId = req.params.userId;
  const state = req.body.state;

  if (!userId) {
    return res.status(400).json({ error: "missing_user_id" });
  }
  if (!state || typeof state !== "object") {
    return res.status(400).json({ error: "missing_or_bad_state" });
  }

  const json = JSON.stringify(state);
  const now = new Date().toISOString();

  db.run(
    "INSERT INTO states (user_id, state_json, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at",
    [userId, json, now],
    (err) => {
      if (err) {
        console.error("DB error", err);
        return res.status(500).json({ error: "db_error" });
      }
      res.json({ ok: true });
    }
  );
});

// Frontend fallback (single page app)
// This wildcard route breaks on Express 5 / newer path-to-regexp.
// For now we skip it; root (/) still serves index.html via express.static.

// app.get("*", (req, res) => {
//   res.sendFile(path.join(publicDir, "index.html"));
// });

app.listen(PORT, () => {
  console.log(`Powerlifting coach server running on http://localhost:${PORT}`);
});
