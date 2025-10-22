// hopper.js

const noblox = require('noblox.js');
const settings = require('./settings.json');
const { getJoinUrls } = require('./join-urls');
require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const kill = require('tree-kill');

// Persistent Chrome profile so you stay signed in
// Auto-enable login mode on first install
const FIRST_RUN_FLAG = path.join(os.homedir(), '.roblox-hopper', 'first-run-done');
const IS_FIRST_INSTALL = !fs.existsSync(FIRST_RUN_FLAG);
// Persistent Chrome profile so you stay signed in
const PERSISTENT_PROFILE = path.join(os.homedir(), '.roblox-hopper-chrome');

// On first install, force login mode = true; otherwise use settings
const LOGIN_MODE = IS_FIRST_INSTALL || settings.Hopper_Login === '1';

// Which chrome binary? You can override via settings or env
const CHROME_BIN = settings.Chrome_Bin || process.env.CHROME_BIN || 'google-chrome';

// Feature flags / settings
const AVOID_FRIENDS = !!settings.Avoid_Friends;

// AlreadyJoinedServerAvoiding behavior:
// - if not provided: default to 1 (avoid last one you joined)
// - if 0 or negative: disabled
// - if provided: avoid that many last servers
const LAST_JOINED_TO_AVOID = (() => {
const raw = settings.AlreadyJoinedServerAvoiding;
if (raw === undefined || raw === null || raw === '') return 1; // default if not passed
const v = Number(raw);
return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 1;
})();

// Where we store recent join history (per placeId)
const APP_DIR = path.join(os.homedir(), '.roblox-hopper');
const HISTORY_PATH = path.join(APP_DIR, 'joined-history.json');
const MAX_HISTORY_PER_PLACE = 100; // keep up to 100 recent JobIds per place

function loadJoinedHistory() {
try {
const txt = fs.readFileSync(HISTORY_PATH, 'utf8');
const data = JSON.parse(txt);
return (data && typeof data === 'object') ? data : {};
} catch {
return {};
}
}

function saveJoinedHistory(history) {
fs.mkdirSync(APP_DIR, { recursive: true });
fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function getRecentBlockedJobIds(placeId, n) {
if (!n || n <= 0) return new Set();
const history = loadJoinedHistory();
const list = Array.isArray(history[placeId]) ? history[placeId] : [];
const recent = list.slice(-n);
return new Set(recent);
}

function recordJoinedServer(placeId, jobId, maxKeep = MAX_HISTORY_PER_PLACE) {
if (!jobId) return;
const history = loadJoinedHistory();
const list = Array.isArray(history[placeId]) ? history[placeId] : [];
// De-duplicate, push latest, cap
const filtered = list.filter(j => j !== jobId);
filtered.push(jobId);
if (filtered.length > maxKeep) {
history[placeId] = filtered.slice(filtered.length - maxKeep);
} else {
history[placeId] = filtered;
}
saveJoinedHistory(history);
}

async function getFriendServerIdsInPlace(placeId, userId) {
  console.log(userId)
  const cookie = process.env.ROBLOX_COOKIE?.trim();
  if (!cookie) {
    console.warn('ROBLOX_COOKIE missing; skipping friend lookup.');
    return new Set();
  }

  // Use your own userId in the URL path
  const url = `https://friends.roblox.com/v1/users/${userId}/friends/online`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      // Roblox expects this header name to contain the cookie
      Cookie: `.ROBLOSECURITY=${cookie}`,
      'User-Agent': 'roblox-hopper/1.0'
    }
  });

  if (!res.ok) {
    console.warn('Could not fetch friends presence, status:', res.status);
    return new Set();
  }

  const body = await res.json();
  // The modern endpoint wraps friend data under body.data[]
  const list = Array.isArray(body?.data) ? body.data : [];

  const blockedJobIds = new Set();
  for (const f of list) {
    const pres = f.userPresence || {};
    const presenceType = pres.UserPresenceType ?? pres.presenceType ?? pres.userPresenceType;
    const place = pres.placeId ?? pres.PlaceId;
    const rootPlace = pres.rootPlaceId ?? pres.RootPlaceId;
    const jobId = pres.gameInstanceId ?? pres.GameId;

    // Roblox presence type: "InGame" or numeric 2
    const isInGame = presenceType === 2 || presenceType === 'InGame';
    if (isInGame && jobId) {
      if (String(place) === String(placeId) || String(rootPlace) === String(placeId)) {
        blockedJobIds.add(jobId);
      }
    }
  }
  return blockedJobIds;
}

function launchChrome(url, profileDir = PERSISTENT_PROFILE) {
fs.mkdirSync(profileDir, { recursive: true });

const args = [
'--new-window',
`--user-data-dir=${profileDir}`,
'--no-first-run',
'--no-default-browser-check',
url,
];

const child = spawn(CHROME_BIN, args, {
detached: false,
stdio: 'ignore',
});

return { child, profileDir };
}

async function startApp() {
var user
// 1) Authenticate
try {
console.log('Logging in...');
const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
console.log(`Logged in as ${currentUser.name} [${currentUser.id}]`)
user = currentUser
} catch (err) {
console.error('Login failed:', err?.message || err);
return;
}

// 2) Find a suitable server
try {
console.log(`\nSearching for a server in Place ID: ${settings.placeId}`);
const servers = await noblox.getGameInstances(
settings.placeId,
'Public',
settings.sortOrder,
settings.limit
);
if (!servers || servers.length === 0) {
console.log('No servers returned.');
return;
}
console.log(`Found ${servers.length} potential servers to check.`);

// Build the blocked sets
let friendBlocked = new Set();
if (AVOID_FRIENDS) {
  console.log('Fetching friends currently in-game to avoid their servers...');
  friendBlocked = await getFriendServerIdsInPlace(settings.placeId, user.id);
  console.log(`Found ${friendBlocked.size} friend server(s) to skip.`);
}

const recentBlocked = getRecentBlockedJobIds(settings.placeId, LAST_JOINED_TO_AVOID);
if (LAST_JOINED_TO_AVOID > 0) {
  console.log(`Avoiding the last ${LAST_JOINED_TO_AVOID} server(s) joined for this place.`);
}

// Combine blocks
const combinedBlocked = new Set([...friendBlocked, ...recentBlocked]);

// Choose target
let targetServer = null;
for (const server of servers) {
  if (server.playing >= settings.maxPlayers) continue;

  if (friendBlocked.has(server.id)) {
    console.log(`Skipping ${server.id} (friend inside).`);
    continue;
  }
  if (recentBlocked.has(server.id)) {
    console.log(`Skipping ${server.id} (recently joined).`);
    continue;
  }

  targetServer = server;
  break;
}

if (!targetServer) {
  console.log('No suitable server found (full, friends inside, or recently joined).');
  return;
}

console.log(`\n✅ Target Acquired!`);
console.log(`   - Server Job ID: ${targetServer.id}`);
console.log(`   - Current Players: ${targetServer.playing}/${targetServer.maxPlayers}`);

const joinScript = getJoinUrls(settings.placeId, targetServer.id);

// 3) Launch + record history
console.log('\nOpening a new browser window to launch Roblox...');
const { child, profileDir } = launchChrome(joinScript.webFallback);
console.log('Chrome PID:', child.pid);

if (IS_FIRST_INSTALL) {
  try {
    fs.mkdirSync(path.dirname(FIRST_RUN_FLAG), { recursive: true });
    fs.writeFileSync(FIRST_RUN_FLAG, String(Date.now()));
    console.log('First install detected: enabled login mode automatically for this run.');
    console.log('A flag was saved; next runs will auto-close unless Hopper_Login is "1".');
  } catch (e) {
    console.warn('Could not write first-run flag:', e?.message || e);
  }
}

// Record after launch attempt
try {
  recordJoinedServer(settings.placeId, targetServer.id, MAX_HISTORY_PER_PLACE);
} catch (e) {
  console.warn('Failed to record joined server history:', e?.message || e);
}

if (!LOGIN_MODE) {
  setTimeout(() => {
    console.log('Closing browser window...');
    kill(child.pid, 'SIGTERM', () => {
      setTimeout(() => {
        kill(child.pid, 'SIGKILL', () => {
          console.log('Browser closed.');
        });
      }, 1000);
    });
  }, 7000);
} else {
  console.log('Hopper login mode: leaving the window open so you can sign in once.');
  console.log('When done, close the window and rerun without Hopper_Login to auto-close.');
}
} catch (err) {
console.error('\n❌ An error occurred during the process:');
console.error(err);
}
}

startApp();