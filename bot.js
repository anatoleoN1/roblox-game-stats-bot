// bot.js — Roblox Stats Bot (V1.2.41) — VERSION AUTO-ADAPTATIVE
import inquirer from "inquirer";
import fetch from "node-fetch";

// ----------------- CONFIG -----------------
const LOCAL_VERSION = "V1.2.41";
const GITHUB_RELEASES_LATEST = "https://api.github.com/repos/anatoleoN1/roblox-game-stats-bot/releases/latest";
const MIN_REFRESH_INTERVAL = 30; // secondes
const MAX_REFRESH_INTERVAL = 300; // max 5 minutes
const FETCH_TIMEOUT_MS = 30000; // 30s
const MAX_RETRIES_429 = 5; // max retries pour 429
const BASE_DELAY = 1000; // délai initial pour backoff exponentiel (ms)

// ----------------- STATE -----------------
let WEBHOOK_URL = null;
let PLACE_ID = null;
let universeId = null;
let discordMessageId = null;

let gameName = "Roblox Game";
let gameIcon = "https://tr.rbxcdn.com/97425ef88919c45c2fc8b1c616eec95d/150/150/Image/Png";

let currentInterval = MIN_REFRESH_INTERVAL; // intervalle actuel (s)
let consecutiveSuccess = 0;

// ----------------- HELPERS -----------------
function normalizeVersion(tag) {
  if (!tag || typeof tag !== "string") return null;
  const cleaned = tag.trim().replace(/^v/i, "").replace(/^V/i, "");
  return cleaned.split(".").map(p => parseInt(p, 10) || 0);
}

function isRemoteNewer(localTag, remoteTag) {
  const l = normalizeVersion(localTag);
  const r = normalizeVersion(remoteTag);
  if (!l || !r) return false;
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    const lv = l[i] || 0;
    const rv = r[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ----------------- FETCH AVEC BACKOFF -----------------
async function fetchWithBackoff(url, options = {}, maxRetries = MAX_RETRIES_429, baseDelay = BASE_DELAY) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Rate limited (429). Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      return res; // ok ou autre erreur HTTP
    } catch (err) {
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn("⚠️ Fetch error:", err.message || err, `Retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

// ----------------- UPDATE CHECK -----------------
async function checkForUpdates() {
  try {
    const res = await fetchWithBackoff(GITHUB_RELEASES_LATEST, { headers: { "User-Agent": "roblox-stats-bot" } });
    if (!res.ok) return;
    const json = await res.json();
    const tag = json.tag_name || json.name || null;
    if (!tag) return;

    if (isRemoteNewer(LOCAL_VERSION, tag)) {
      console.log("⚠️  Update available! Current:", LOCAL_VERSION, "Latest:", tag);
      console.log("To update: git reset --hard git pull or download latest release");
    } else {
      console.log(`✅ Bot is up to date (version ${LOCAL_VERSION})\n`);
    }
  } catch (err) {
    console.warn("❌ Failed to check for updates:", err.message || err);
  }
}

// ----------------- API FUNCTIONS -----------------
async function fetchUniverseId(placeId) {
  try {
    const res = await fetchWithBackoff(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.universeId ?? null;
  } catch (err) {
    console.error("❌ Error fetching universeId:", err.message || err);
    return null;
  }
}

async function fetchGameInfo(universeIdParam) {
  try {
    const res = await fetchWithBackoff(`https://games.roproxy.com/v1/games?universeIds=${universeIdParam}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entry = data?.data?.[0];
    gameName = entry?.name ?? "Roblox Game";

    // fetch icon
    try {
      const iconRes = await fetchWithBackoff(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeIdParam}&size=256x256&format=Png`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (iconRes.ok) {
        const iconData = await iconRes.json();
        if (iconData?.data?.[0]?.imageUrl) gameIcon = iconData.data[0].imageUrl;
      }
    } catch {}
  } catch (err) {
    console.error("❌ Error fetching game info:", err.message || err);
  }
}

async function fetchGameStats(universeIdParam) {
  try {
    const statsRes = await fetchWithBackoff(`https://games.roproxy.com/v1/games?universeIds=${universeIdParam}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);
    const statsJson = await statsRes.json();
    const entry = statsJson?.data?.[0];

    const favRes = await fetchWithBackoff(`https://games.roproxy.com/v1/games/${universeIdParam}/favorites/count`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const favoritesCount = (favRes.ok ? (await favRes.json())?.favoritesCount : 0) ?? 0;

    return {
      playing: entry?.playing ?? 0,
      visits: entry?.visits ?? 0,
      favorites: favoritesCount
    };
  } catch (err) {
    console.warn("⚠️ Error fetching stats:", err.message || err);
    return { playing: "N/A", visits: "N/A", favorites: "N/A" };
  }
}

// ----------------- DISCORD -----------------
function buildEmbed(stats) {
  const utc = new Date().toISOString();
  return {
    username: gameName,
    avatar_url: gameIcon,
    embeds: [{
      title: `Live Stats — ${gameName}`,
      color: 0x4fa3ff,
      fields: [
        { name: "Players Online", value: `${stats.playing}`, inline: true },
        { name: "Visits", value: `${stats.visits}`, inline: true },
        { name: "Favorites", value: `${stats.favorites}`, inline: true }
      ],
      footer: { text: "Roblox Stats Discord Bot © 2025 by Anatoleo | " + LOCAL_VERSION },
      timestamp: utc
    }]
  };
}

async function updateStats() {
  let had429 = false;

  if (!universeId) {
    universeId = await fetchUniverseId(PLACE_ID);
    if (!universeId) {
      console.warn("❌ Could not resolve universeId; retrying next cycle");
      had429 = true;
    }
  }

  if (!gameName || gameName === "Roblox Game" || gameName === "Unknown Game") {
    await fetchGameInfo(universeId).catch(() => { had429 = true; });
  }

  const stats = await fetchGameStats(universeId).catch(() => { had429 = true; });
  const payload = buildEmbed(stats || { playing: "N/A", visits: "N/A", favorites: "N/A" });

  try {
    if (!discordMessageId) {
      const res = await fetchWithBackoff(WEBHOOK_URL + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (res.ok) {
        const data = await res.json();
        discordMessageId = data.id;
        console.log("✅ First message sent to Discord");
      }
    } else {
      const res = await fetchWithBackoff(`${WEBHOOK_URL}/messages/${discordMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (res.ok) {
        const now = new Date();
        console.log(`♻️ Message updated at ${now.toLocaleString("fr-FR")}`);
      }
    }
  } catch (err) {
    console.error("❌ Discord error:", err.message || err);
    had429 = true;
  }

  // Ajustement automatique de l’intervalle
  if (had429) {
    currentInterval = Math.min(MAX_REFRESH_INTERVAL, currentInterval * 1.5);
    consecutiveSuccess = 0;
  } else {
    consecutiveSuccess++;
    if (consecutiveSuccess >= 3) {
      currentInterval = Math.max(MIN_REFRESH_INTERVAL, currentInterval * 0.9);
      consecutiveSuccess = 0;
    }
  }

  // Planifier le prochain update
  setTimeout(updateStats, currentInterval * 1000);
  console.log(`⏳ Next update in ${Math.round(currentInterval)} sec`);
}

// ----------------- MAIN -----------------
async function main() {
  console.log("=== ROBLOX STATS BOT → DISCORD ===\n");
  await checkForUpdates();

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "gameUrl",
      message: "Enter Roblox game URL:",
      validate: input => /roblox\.com\/games\/\d+/.test(input) || "Invalid Roblox URL"
    },
    {
      type: "input",
      name: "webhookUrl",
      message: "Enter Discord webhook URL:",
      validate: input => input.startsWith("https://discord.com/api/webhooks/") || "Invalid Webhook"
    },
    {
      type: "confirm",
      name: "existingMessage",
      message: "Have you already sent a message with this webhook?",
      default: false
    }
  ]);

  PLACE_ID = answers.gameUrl.match(/roblox\.com\/games\/(\d+)/)[1];
  WEBHOOK_URL = answers.webhookUrl;

  if (answers.existingMessage) {
    const messageAnswer = await inquirer.prompt([{
      type: "input",
      name: "messageId",
      message: "Enter the message ID or full message link:",
      validate: input => input.length > 0 || "Please enter a valid ID or link"
    }]);
    const linkParts = messageAnswer.messageId.split("/");
    discordMessageId = linkParts[linkParts.length - 1];
    console.log(`✅ Existing message will be updated: ${discordMessageId}`);
  } else {
    console.log("✅ A new message will be created on Discord");
  }

  console.log(`🎮 Roblox Game ID: ${PLACE_ID}`);
  console.log(`📩 Discord Webhook: ${WEBHOOK_URL}`);
  console.log(`⏳ Initial refresh interval: ${currentInterval} sec\n`);

  updateStats();
}

main();
