⚙️ Setup & Configuration
Before running Roblox Hopper, you need to add your Roblox security cookie and configure your settings.

1️⃣ Environment File
Create a .env file (or rename .env.template → .env) in the project root, then paste your cookie:

# .env
ROBLOX_COOKIE=_|WARNING:-DO-NOT-SHARE-THIS.--your--long--roblosecurity--value
⚠️ Do not share or upload this file.
The .ROBLOSECURITY cookie grants full access to your Roblox account.
Keep this file local and private at all times.

2️⃣ Settings
You can freely tweak settings.json to control hopping behavior:

Setting	Description
placeId	Roblox place to join
maxPlayers	Maximum players allowed before skipping a server
limit	Number of public servers to scan
sortOrder	"Asc" or "Desc" – order servers are fetched
Avoid_Friends	Skip servers that friends are currently in
AlreadyJoinedServerAvoiding	Avoid the last N servers you joined
Hopper_Login	"1" to keep Chrome open (login mode), "0" to auto‑close
Chrome_Bin	Path or name of your Chrome binary (e.g. google‑chrome or chromium)
🌐 Local Website Interface
A simple local control panel lets you manage and launch hoppers directly from your browser.

▶️ Start the Website

npm run website

Then open your browser to:

👉 http://localhost:3000

🧭 From the Web UI, you can:
View and edit all settings in a tidy dashboard
Paste your .ROBLOSECURITY cookie once
Click Start Hopper to launch Roblox into a matching server
Click Stop Hopper to terminate the active browser session
Watch real‑time logs appear in the terminal‑style viewer
The interface runs entirely on your machine—no online connections except Roblox’s own servers—so your cookie and data never leave your computer.
