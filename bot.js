// Roblox Stats Bot → Discord Webhook
// Requirements: Node.js 18+
// External dependency: inquirer (npm install inquirer)
//
// Usage:
//   1. Run "node bot.js"
//   2. Enter Roblox game URL and Discord webhook URL
//   3. Bot will send stats every REFRESH_INTERVAL seconds, editing the same message

import inquirer from "inquirer";

let WEBHOOK_URL = null;
let PLACE_ID = null;
let universeId = null;
let discordMessageId = null;

let gameName = "Roblox Game";
let gameIcon = "https://tr.rbxcdn.com/97425ef88919c45c2fc8b1c616eec95d/150/150/Image/Png";

// Refresh interval in seconds
const REFRESH_INTERVAL = 5;

// ------------------ API FUNCTIONS ------------------

async function fetchUniverseId(placeId) {
  const res = await fetch(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`);
  const data = await res.json();
  return data.universeId;
}

async function fetchGameInfo(universeId) {
  const res = await fetch(`https://games.roproxy.com/v1/games?universeIds=${universeId}`);
  const data = await res.json();
  const entry = data.data[0];
  gameName = entry.name || "Roblox Game";
  
  // Fetch game icon
  const iconRes = await fetch(
    `https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeId}&size=256x256&format=Png`
  );
  const iconData = await iconRes.json();
  if (iconData.data && iconData.data[0] && iconData.data[0].imageUrl) {
    gameIcon = iconData.data[0].imageUrl;
  }
}

async function fetchGameStats(universeId) {
  try {
    const [statsRes, favRes] = await Promise.all([
      fetch(`https://games.roproxy.com/v1/games?universeIds=${universeId}`, { signal: AbortSignal.timeout(15000) }),
      fetch(`https://games.roproxy.com/v1/games/${universeId}/favorites/count`, { signal: AbortSignal.timeout(15000) })
    ]);

    const statsJson = await statsRes.json();
    const entry = statsJson?.data && statsJson.data.length > 0 ? statsJson.data[0] : null;
    const favJson = await favRes.json();

    if (!entry) {
      console.warn("⚠️ No data returned from Roblox API");
      return { playing: 0, visits: 0, favorites: 0 };
    }

    return {
      playing: entry.playing ?? 0,
      visits: entry.visits ?? 0,
      favorites: favJson.favoritesCount ?? 0
    };

  } catch (err) {
    console.error("API error:", err.message || err);
    return { playing: "N/A", visits: "N/A", favorites: "N/A" };
  }
}


// ------------------ DISCORD FUNCTIONS ------------------

function buildEmbed(stats) {
  const now = new Date();
  const utcString = now.toISOString(); // UTC+0
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
          text: "Roblox Stats Discord Bot © 2025 by Anatoleo is licensed under CC BY 4.0 | created by @anatoleo, powered by IA. V1.2.20"
        },
        timestamp: utcString
      }
    ]
  };
}


async function updateStats() {
  if (!universeId) universeId = await fetchUniverseId(PLACE_ID);
  if (!gameName || gameName === "Roblox Game") await fetchGameInfo(universeId);

  const stats = await fetchGameStats(universeId);
  const payload = buildEmbed(stats);

  try {
    if (!discordMessageId) {
      // First message
      const res = await fetch(WEBHOOK_URL + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      discordMessageId = data.id;
      console.log("✅ First message sent to Discord");
    } else {
      // Edit message
      await fetch(`${WEBHOOK_URL}/messages/${discordMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const now = new Date();
      const timestamp = now.toLocaleDateString("fr-FR") + " à " + now.toLocaleTimeString("fr-FR");
      console.log(`♻️ Message updated at ${timestamp}`);
    }
  } catch (err) {
    console.error("❌ Discord error:", err);
  }
}


// ------------------ MAIN ------------------

async function main() {
  console.log("=== ROBLOX STATS BOT → DISCORD ===\n");

  // Interactive setup
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "gameUrl",
      message: "Enter Roblox game URL:",
      validate: (input) => input.includes("roblox.com/games/") || "Invalid Roblox URL"
    },
    {
      type: "input",
      name: "webhookUrl",
      message: "Enter Discord webhook URL:",
      validate: (input) => input.startsWith("https://discord.com/api/webhooks/") || "Invalid Webhook"
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

    // Extract ID if a full link is provided
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

  // Start loop
  setInterval(updateStats, REFRESH_INTERVAL * 1000);
  updateStats();
}


main();
