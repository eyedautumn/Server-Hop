// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");
const settings = require("./settings.json")

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "web")));

let activeProcess = null;

function OpenSite() {
  const env = Object.assign({}, process.env, {
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,
  });

  const args = [path.join("web", "openSite.js")];
  return spawn("node", args, { env, stdio: ["ignore", "pipe", "pipe"] });
}

// === API: start hopper ===
app.post("/api/start", (req, res) => {
  if (activeProcess) return res.json({ ok: false, msg: "Already running"});
  const env = Object.assign({}, process.env, {
    ROBLOX_COOKIE: req.body.cookie || process.env.ROBLOX_COOKIE,
  });

  const args = [path.join(__dirname, "hopper.js")];
  const child = spawn("node", args, { env, stdio: ["ignore", "pipe", "pipe"] });

  activeProcess = child;
  console.log("Started hopper pid", child.pid);

  child.stdout.on("data", d => process.stdout.write(d));
  child.stderr.on("data", d => process.stderr.write(d));
  child.on("exit", () => { activeProcess = null; });

  res.json({ ok: true, pid: child.pid });
});

// === API: stop hopper ===
app.post("/api/stop", (req, res) => {
  if (!activeProcess) return res.json({ ok: false, msg: "No active process" });
  activeProcess.kill("SIGTERM");
  res.json({ ok: true, msg: "Sent stop signal" });
});

// === API: save settings ===
const fs = require("fs");
app.post("/api/settings", (req, res) => {
  fs.writeFileSync(path.join(__dirname, "settings.json"), JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// === API: load settings ===
app.get("/api/settings", (req, res) => {
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json"), "utf8"));
  res.json(s);
});

const PORT = settings.Port;
app.listen(PORT, () =>
  console.log(`Web interface running → http://localhost:${PORT}`),
  OpenSite()
);