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
      fetch(`https://games.roproxy.com/v1/games?universeIds=${universeId}`),
      fetch(`https://games.roproxy.com/v1/games/${universeId}/favorites/count`)
    ]);

    const statsJson = await statsRes.json();
    const entry = statsJson.data[0];
    const favJson = await favRes.json();

    return {
      playing: entry.playing,
      visits: entry.visits,
      favorites: favJson.favoritesCount
    };
  } catch (err) {
    console.error("API error:", err);
    return { playing: "?", visits: "?", favorites: "?" };
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
        description: `<a href="https://github.com/anatoleoN1/roblox-game-stats-bot">Roblox Stats Discord Bot</a> © 2025 by <a href="https://github.com/anatoleoN1">Anatoleo</a> is licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a><img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;"><img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;">`,
        footer: { text: "created by @anatoleo, powered by IA. V1.2.20" },
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
