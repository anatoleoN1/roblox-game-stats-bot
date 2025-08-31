const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Mini serveur "keep-alive"
app.get("/", (req, res) => res.send("Bot Vorton en ligne ✅"));
app.listen(PORT, () => console.log(`Keep-alive sur port ${PORT}`));

// Ton bot Vorton (copié depuis bot.js)
const WEBHOOK_URL = "https://discord.com/api/webhooks/1411779190654505000/aM-WgQldth7uVSniBYOQzCzZORZIH2WMeCSE1M_-IO84Jx7bwXFo-YcvL8c8IPVTn8MC";
const PLACE_ID = 127563875465586;

let universeId = null;
let discordMessageId = null;

async function fetchUniverseId(placeId) {
  const res = await fetch(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`);
  const data = await res.json();
  return data.universeId;
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
    console.error("Erreur API:", err);
    return { playing: "?", visits: "?", favorites: "?" };
  }
}

function buildEmbed(stats) {
  return {
    username: "Vorton Stats Bot",
    avatar_url: "https://tr.rbxcdn.com/97425ef88919c45c2fc8b1c616eec95d/150/150/Image/Png",
    embeds: [
      {
        title: "Vorton [Alpha] — Live Stats",
        color: 0x4fa3ff,
        fields: [
          { name: "Joueurs en ligne", value: `${stats.playing}`, inline: true },
          { name: "Visites", value: `${stats.visits.toLocaleString("fr-FR")}`, inline: true },
          { name: "Favoris", value: `${stats.favorites.toLocaleString("fr-FR")}`, inline: true }
        ],
        footer: { text: "Dernière mise à jour" },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

async function updateStats() {
  if (!universeId) universeId = await fetchUniverseId(PLACE_ID);
  const stats = await fetchGameStats(universeId);
  const payload = buildEmbed(stats);

  try {
    if (!discordMessageId) {
      const res = await fetch(WEBHOOK_URL + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      discordMessageId = data.id;
      console.log("✅ Premier message envoyé sur Discord");
    } else {
      await fetch(`${WEBHOOK_URL}/messages/${discordMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("♻️ Message mis à jour");
    }
  } catch (err) {
    console.error("❌ Erreur Discord:", err);
  }
}

setInterval(updateStats, 5000);
updateStats();
