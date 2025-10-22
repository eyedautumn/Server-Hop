const Settings = require("../settings.json")
const PORT = Settings.Port
const { spawn } = require("child_process");

function launchChrome(url) {

const args = [
'--no-first-run',
'--no-default-browser-check',
url,
];

const child = spawn(Settings.Chrome_Bin, args, {
detached: false,
stdio: 'ignore',
});

return { child, profileDir };
}

launchChrome(`http://localhost:${PORT}`)