function log(line) {
  const el = document.getElementById('log');
  const div = document.createElement('div');
  div.textContent = line;
  div.classList.add('flash');
  el.append(div);
  el.scrollTop = el.scrollHeight;
}

async function loadSettings() {
  const s = await fetch("/api/settings").then(r => r.json());
  document.querySelector("#placeId").value = s.placeId ?? '';
  document.querySelector("#maxPlayers").value = s.maxPlayers ?? 8;
  document.querySelector("#limit").value = s.limit ?? 100;
  document.querySelector("#sortOrder").value = s.sortOrder ?? 'Asc';
  document.querySelector("#avoidFriends").value = String(!!s.Avoid_Friends);
  document.querySelector("#avoidLastN").value = s.AlreadyJoinedServerAvoiding ?? 1;
  document.querySelector("#hopperLogin").value = s.Hopper_Login ?? '0';
  document.querySelector("#chromeBin").value = s.Chrome_Bin ?? 'google-chrome';
}

async function saveSettings() {
  const s = {
    placeId: Number(document.querySelector("#placeId").value),
    maxPlayers: Number(document.querySelector("#maxPlayers").value),
    limit: Number(document.querySelector("#limit").value),
    sortOrder: document.querySelector("#sortOrder").value,
    Avoid_Friends: document.querySelector("#avoidFriends").value === 'true',
    AlreadyJoinedServerAvoiding: Number(document.querySelector("#avoidLastN").value),
    Hopper_Login: document.querySelector("#hopperLogin").value,
    Chrome_Bin: document.querySelector("#chromeBin").value
  };
  await fetch("/api/settings", {method:"POST", headers:{'Content-Type':'application/json'}, body:JSON.stringify(s)});
  log("Settings saved!");
}

async function startHopper() {
  log("Starting hopper...");
  const cookie = document.querySelector("#cookie").value.trim();
  const res = await fetch("/api/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookie })
  });
  const data = await res.json();
  log(JSON.stringify(data));
}

async function stopHopper() {
  const res = await fetch("/api/stop", { method: "POST" });
  log(await res.text());
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  document.querySelector("#save").onclick = saveSettings;
  document.querySelector("#start").onclick = startHopper;
  document.querySelector("#stop").onclick = stopHopper;
});