// bot.js — Roblox Stats Bot (V1.2.41)
// Requirements: Node.js 18+
// Dependencies: inquirer, node-fetch
//
// Usage:
//   npm install
//   node bot.js

import inquirer from "inquirer";
import fetch from "node-fetch";

// ----------------- CONFIG -----------------
const LOCAL_VERSION = "V1.2.41";
const GITHUB_RELEASES_LATEST = "https://api.github.com/repos/anatoleoN1/roblox-game-stats-bot/releases/latest";
const REFRESH_INTERVAL = 20; // seconds
const FETCH_TIMEOUT_MS = 30000; // 30s

// ----------------- STATE -----------------
let WEBHOOK_URL = null;
let PLACE_ID = null;
let universeId = null;
let discordMessageId = null;

let gameName = "Roblox Game";
let gameIcon = "https://tr.rbxcdn.com/97425ef88919c45c2fc8b1c616eec95d/150/150/Image/Png";

// ----------------- HELPERS -----------------
function normalizeVersion(tag) {
  // Accepts "V1.2.41", "v1.2.41", "1.2.41" -> returns [1,2,41]
  if (!tag || typeof tag !== "string") return null;
  const cleaned = tag.trim().replace(/^v/i, "").replace(/^V/i, "");
  const parts = cleaned.split(".").map(p => parseInt(p, 10) || 0);
  return parts;
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

function safeLogDateUTC() {
  const d = new Date();
  return d.toISOString(); // UTC+0
}

// ----------------- UPDATE CHECK (GitHub Releases) -----------------
async function checkForUpdates() {
  try {
    const res = await fetch(GITHUB_RELEASES_LATEST, {
      headers: { "User-Agent": "roblox-stats-bot" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) {
      console.warn(`⚠️ Update check HTTP ${res.status} — skipping check`);
      return;
    }
    const json = await res.json();
    const tag = json.tag_name || json.name || null;
    if (!tag) return;

    if (isRemoteNewer(LOCAL_VERSION, tag)) {
      console.log("------------------------------------------------------------");
      console.log(`⚠️  Update available! Current: ${LOCAL_VERSION}, Latest: ${tag}`);
      console.log("");
      console.log("To update the bot, run:");
      console.log("  git pull");
      console.log("");
      console.log("Or download the latest release:");
      console.log("  " + (json.html_url || "https://github.com/anatoleoN1/roblox-game-stats-bot/releases/latest"));
      console.log("------------------------------------------------------------\n");
    } else {
      console.log(`✅ Bot is up to date (version ${LOCAL_VERSION})\n`);
    }
  } catch (err) {
    console.warn("❌ Failed to check for updates:", err.message || err);
  }
}

// ------------------ API FUNCTIONS ------------------
async function fetchUniverseId(placeId) {
  try {
    const res = await fetch(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
    const res = await fetch(`https://games.roproxy.com/v1/games?universeIds=${universeIdParam}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      console.warn("⚠️ Roblox API returned no game info.");
      gameName = "Unknown Game";
    } else {
      const entry = data.data[0];
      gameName = entry?.name ?? "Roblox Game";
    }

    // icon
    try {
      const iconRes = await fetch(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeIdParam}&size=256x256&format=Png`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (iconRes.ok) {
        const iconData = await iconRes.json();
        if (iconData?.data?.[0]?.imageUrl) gameIcon = iconData.data[0].imageUrl;
        else console.warn("⚠️ No icon returned");
      } else {
        console.warn("⚠️ Icon fetch HTTP", iconRes.status);
      }
    } catch (err) {
      console.warn("⚠️ Failed to fetch icon:", err.message || err);
    }

  } catch (err) {
    console.error("❌ Error fetching game info:", err.message || err);
    gameName = "Unknown Game";
  }
}

async function fetchGameStats(universeIdParam) {
  try {
    const [statsRes, favRes] = await Promise.all([
      fetch(`https://games.roproxy.com/v1/games?universeIds=${universeIdParam}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
      fetch(`https://games.roproxy.com/v1/games/${universeIdParam}/favorites/count`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    ]);

    if (!statsRes.ok) {
      console.warn("⚠️ Stats endpoint HTTP", statsRes.status);
      return { playing: "N/A", visits: "N/A", favorites: "N/A" };
    }
    if (!favRes.ok) {
      console.warn("⚠️ Favorites endpoint HTTP", favRes.status);
    }

    const statsJson = await statsRes.json().catch(()=>null);
    const favJson = await favRes.json().catch(()=>null);

    const entry = statsJson?.data?.[0] ?? null;
    const favoritesCount = favJson?.favoritesCount ?? null;

    if (!entry) {
      console.warn("⚠️ No stats data returned from Roblox API");
      return { playing: 0, visits: 0, favorites: favoritesCount ?? 0 };
    }

    return {
      playing: entry.playing ?? 0,
      visits: entry.visits ?? 0,
      favorites: favoritesCount ?? 0
    };
  } catch (err) {
    console.error("API error:", err.message || err);
    return { playing: "N/A", visits: "N/A", favorites: "N/A" };
  }
}

// ------------------ DISCORD FUNCTIONS ------------------
function buildEmbed(stats) {
  const utc = new Date().toISOString(); // UTC+0
  return {
    username: gameName,
    avatar_url: gameIcon,
    embeds: [
      {
        title: `Live Stats — ${gameName}`,
        color: 0x4fa3ff,
        fields: [
          { name: "Players Online", value: `${stats.playing}`, inline: true },
          { name: "Visits", value: `${stats.visits}`, inline: true },
          { name: "Favorites", value: `${stats.favorites}`, inline: true }
        ],
        footer: {
          text: "Roblox Stats Discord Bot © 2025 by Anatoleo is licensed under CC BY 4.0. To view a copy of this license, visit https://creativecommons.org/licenses/by/4.0/ | created by @anatoleo, powered by IA. " + LOCAL_VERSION
        },
        timestamp: utc
      }
    ]
  };
}

async function updateStats() {
  // ensure universeId
  if (!universeId) {
    universeId = await fetchUniverseId(PLACE_ID);
    if (!universeId) {
      console.warn("❌ Could not resolve universeId; will retry next cycle.");
      return;
    }
  }

  if (!gameName || gameName === "Roblox Game" || gameName === "Unknown Game") {
    await fetchGameInfo(universeId);
  }

  const stats = await fetchGameStats(universeId);
  const payload = buildEmbed(stats);

  try {
    if (!discordMessageId) {
      const res = await fetch(WEBHOOK_URL + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!res.ok) throw new Error(`Discord webhook POST HTTP ${res.status}`);
      const data = await res.json();
      discordMessageId = data.id;
      console.log("✅ First message sent to Discord");
    } else {
      const res = await fetch(`${WEBHOOK_URL}/messages/${discordMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!res.ok) {
        console.warn("⚠️ Discord edit responded", res.status);
      } else {
        const now = new Date();
        const timestamp = now.toLocaleDateString("fr-FR") + " à " + now.toLocaleTimeString("fr-FR");
        console.log(`♻️ Message updated at ${timestamp}`);
      }
    }
  } catch (err) {
    console.error("❌ Discord error:", err.message || err);
  }
}

// ------------------ MAIN ------------------
async function main() {
  console.log("=== ROBLOX STATS BOT → DISCORD ===\n");

  // check for updates
  await checkForUpdates();

  // prompts
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "gameUrl",
      message: "Enter Roblox game URL:",
      validate: input => input.includes("roblox.com/games/") || "Invalid Roblox URL"
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

  PLACE_ID = answers.gameUrl.split("/")[4];
  WEBHOOK_URL = answers.webhookUrl;

  if (answers.existingMessage) {
    const messageAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "messageId",
        message: "Enter the message ID or full message link:",
        validate: (input) => input.length > 0 || "Please enter a valid ID or link"
      }
    ]);

    const linkParts = messageAnswer.messageId.split("/");
    discordMessageId = linkParts[linkParts.length - 1];
    console.log(`✅ Existing message will be updated: ${discordMessageId}`);
  } else {
    discordMessageId = null;
    console.log("✅ A new message will be created on Discord");
  }

  console.log(`🎮 Roblox Game ID: ${PLACE_ID}`);
  console.log(`📩 Discord Webhook: ${WEBHOOK_URL}`);
  console.log(`⏳ Refresh every ${REFRESH_INTERVAL} sec\n`);

  // start interval
  setInterval(updateStats, REFRESH_INTERVAL * 1000);
  updateStats();
}

main();
