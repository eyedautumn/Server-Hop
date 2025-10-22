// hopper.js

const noblox = require('noblox.js');
const settings = require('./settings.json');
const { getJoinUrls } = require('./join-urls'); // Using your file as requested
require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const kill = require('tree-kill');

const PERSISTENT_PROFILE = path.join(os.homedir(), '.roblox-hopper-chrome');
// set HOPPER_LOGIN=1 for a run where you want to sign in manually
const LOGIN_MODE = process.env.HOPPER_LOGIN === '1';

// which chrome binary? adjust if needed: google-chrome-stable or chromium
const CHROME_BIN = process.env.CHROME_BIN || 'google-chrome';

// add near the top
const AVOID_FRIENDS = settings.Avoid_Friends

async function getFriendServerIdsInPlace(placeId) {
  // Use built-in fetch in Node 18+. If you're on older Node, install node-fetch and replace with:
  // const fetch = (await import('node-fetch')).default;
  const res = await fetch('https://friends.roblox.com/v1/my/friends/online', {
    headers: {
      // Use your existing cookie from .env; noblox.setCookie is already called, but for this direct request we add the cookie header.
      Cookie: `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE}`,
      'User-Agent': 'roblox-hopper/1.0'
    }
  });
  if (!res.ok) {
    console.warn('Could not fetch friends presence, status:', res.status);
    return new Set();
  }
  const body = await res.json();
  const list = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);

  const blockedJobIds = new Set();
  for (const f of list) {
    const presence = f.userPresenceType ?? f.presenceType ?? f.UserPresenceType ?? f.PresenceType;
    const friendPlaceId = f.placeId ?? f.PlaceId;
    const friendRootPlaceId = f.rootPlaceId ?? f.RootPlaceId;
    const jobId = f.gameId ?? f.GameId;

    // 2 = InGame (Roblox presence enum)
    if (presence === 2 && jobId) {
      if (String(friendPlaceId) === String(placeId) || String(friendRootPlaceId) === String(placeId)) {
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
    // Dynamically import the 'open' package
    const open = (await import('open')).default;

    // ... (Authentication and server finding code is unchanged) ...
    // 1. Authenticate...
    try {
        console.log("Logging in...");
        const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log(`Logged in as: ${currentUser.UserName} [${currentUser.UserID}]`);
    } catch (err) { /* ... */ return; }

    // 2. Find a suitable server...
    try {
        console.log(`\nSearching for a server in Place ID: ${settings.placeId}`);
const servers = await noblox.getGameInstances(settings.placeId, "Public", settings.sortOrder, settings.limit);
if (servers.length === 0) { /* ... */ return; }
console.log(`Found ${servers.length} potential servers to check.`);

let blockedJobIds = new Set();
if (AVOID_FRIENDS) {
  console.log('Fetching friends currently in-game to avoid their servers...');
  blockedJobIds = await getFriendServerIdsInPlace(settings.placeId);
  console.log(`Found ${blockedJobIds.size} friend server(s) to skip.`);
}

// pick a server that isn't full and doesn't contain friends
let targetServer = null;
for (const server of servers) {
  if (server.playing < settings.maxPlayers) {
    if (AVOID_FRIENDS && blockedJobIds.has(server.id)) {
      console.log(`Skipping server ${server.id} (friend inside).`);
      continue;
    }
    targetServer = server;
    break;
  }
}

if (!targetServer) {
  console.log('No suitable server found (either full or only friend servers).');
  return;
}

console.log(`\n✅ Target Acquired!`);
console.log(`   - Server Job ID: ${targetServer.id}`);
console.log(`   - Current Players: ${targetServer.playing}/${targetServer.maxPlayers}`);

const joinScript = getJoinUrls(settings.placeId, targetServer.id);
        
        
        // 4. IMPLEMENTING YOUR PLAN: Open a new window, launch, and close.
        console.log("\nOpening a new browser window to launch Roblox...");

const { child, profileDir } = launchChrome(joinScript.webFallback);
console.log('Chrome PID:', child.pid);

if (!LOGIN_MODE) {
  setTimeout(() => {
    console.log('Closing browser window...');
    kill(child.pid, 'SIGTERM', () => {
      setTimeout(() => {
        kill(child.pid, 'SIGKILL', () => {
          console.log('Browser closed.');
          // IMPORTANT: do NOT delete profileDir; we want to stay logged in
          // fs.rm(profileDir, { recursive: true, force: true }, () => {});
        });
      }, 1000);
    });
  }, 7000);
} else {
  console.log('HOPPER_LOGIN=1: leaving the window open so you can sign in once.');
  console.log(`When done, close the window and rerun without HOPPER_LOGIN to auto-close.`);
}

    } catch (err) {
        console.error("\n❌ An error occurred during the process:");
        console.error(err);
    }
}

startApp();