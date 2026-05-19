// bot.js — Roblox Multi-Stats Bot (V2.1) — ESM Version
import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import fs from "fs";

// ----------------- CHARGEMENT CONFIG -----------------
const configFile = "./config.json";
if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ TOKEN: "MTUwNjM4MjYxNTMxNjl2NzExOA.GP1P_L.1nwL731fVy9nXJaeDNSomHwNfZQOjyGOFukUXO", trackedGames: [] }, null, 2));
    console.error("❌ Le fichier config.json a été créé. Remplis ton TOKEN avant de lancer.");
    process.exit(1);
}
let config = JSON.parse(fs.readFileSync(configFile, "utf-8"));

const LOCAL_VERSION = "V2.1.0-Multi";
const FETCH_TIMEOUT_MS = 30000;
const MAX_RETRIES_429 = 5;
const BASE_DELAY = 1000;

// Sauvegarde automatique de la configuration sur le disque
function saveConfig() {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

// ----------------- INITIALISATION BOT DISCORD -----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ----------------- HELPERS / API ROBLOX -----------------
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithBackoff(url, options = {}, maxRetries = MAX_RETRIES_429, baseDelay = BASE_DELAY) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`⚠️ Rate limited (429). Retrying in ${delay / 1000}s...`);
                await sleep(delay);
                continue;
            }
            return res;
        } catch (err) {
            const delay = baseDelay * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
    throw new Error(`Failed to fetch ${url}`);
}

async function fetchUniverseId(placeId) {
    try {
        const res = await fetchWithBackoff(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data?.universeId ?? null;
    } catch { return null; }
}

async function fetchGameStats(universeIdParam) {
    try {
        const statsRes = await fetchWithBackoff(`https://games.roproxy.com/v1/games?universeIds=${universeIdParam}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        const statsJson = await statsRes.json();
        const entry = statsJson?.data?.[0];

        const favRes = await fetchWithBackoff(`https://games.roproxy.com/v1/games/${universeIdParam}/favorites/count`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        const favoritesCount = (favRes.ok ? (await favRes.json())?.favoritesCount : 0) ?? 0;

        return {
            name: entry?.name ?? "Roblox Game",
            playing: entry?.playing ?? 0,
            visits: entry?.visits ?? 0,
            favorites: favoritesCount
        };
    } catch {
        return { name: "Roblox Game", playing: "N/A", visits: "N/A", favorites: "N/A" };
    }
}

async function fetchGameIcon(universeIdParam) {
    try {
        const res = await fetchWithBackoff(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeIdParam}&size=256x256&format=Png`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (res.ok) {
            const data = await res.json();
            return data?.data?.[0]?.imageUrl ?? null;
        }
    } catch {}
    return "https://tr.rbxcdn.com/97425ef88919c45c2fc8b1c616eec95d/150/150/Image/Png";
}

function buildEmbed(stats, iconUrl) {
    return {
        title: `Live Stats — ${stats.name}`,
        color: 0x4fa3ff,
        thumbnail: { url: iconUrl },
        fields: [
            { name: "👤 Joueurs en ligne", value: `**${stats.playing}**`, inline: true },
            { name: "⭐ Favoris", value: `**${stats.favorites}**`, inline: true },
            { name: "📉 Visites totales", value: `**${stats.visits}**`, inline: true }
        ],
        footer: { text: `Roblox Stats Bot • ${LOCAL_VERSION}` },
        timestamp: new Date().toISOString()
    };
}

// ----------------- BOUCLE DE SUIVI UNIQUE PAR JEU -----------------
async function startTracking(gameObject) {
    const PLACE_ID = gameObject.robloxUrl.match(/roblox\.com\/games\/(\d+)/)?.[1];
    if (!PLACE_ID) return console.error(`❌ URL Invalide pour le salon ${gameObject.channelId}`);

    let universeId = null;
    let gameIcon = null;
    let currentInterval = 300; // 5 minutes de base par défaut
    let consecutiveSuccess = 0;

    async function loop() {
        // Si le jeu a été supprimé de la config pendant qu'on tournait, on arrête la boucle
        if (!config.trackedGames.some(g => g.channelId === gameObject.channelId)) {
            console.log(`🛑 Arrêt de la surveillance pour le salon ${gameObject.channelId}`);
            return;
        }

        let had429 = false;

        if (!universeId) {
            universeId = await fetchUniverseId(PLACE_ID);
            if (!universeId) had429 = true;
        }

        if (universeId && !gameIcon) {
            gameIcon = await fetchGameIcon(universeId);
        }

        if (universeId) {
            const stats = await fetchGameStats(universeId).catch(() => { had429 = true; });
            const embedPayload = buildEmbed(stats, gameIcon);

            try {
                const channel = await client.channels.fetch(gameObject.channelId);
                if (channel) {
                    if (!gameObject.discordMessageId) {
                        // Nouveau message automatique
                        const msg = await channel.send({ embeds: [embedPayload] });
                        gameObject.discordMessageId = msg.id;
                        saveConfig();
                        console.log(`✅ Premier message de stats créé pour "${stats.name}"`);
                    } else {
                        // Modification du message existant
                        try {
                            const msg = await channel.messages.fetch(gameObject.discordMessageId);
                            await msg.edit({ embeds: [embedPayload] });
                            console.log(`♻️ Synchronisation réussie pour "${stats.name}"`);
                        } catch {
                            // Si le message a été supprimé, on en recrée un
                            const msg = await channel.send({ embeds: [embedPayload] });
                            gameObject.discordMessageId = msg.id;
                            saveConfig();
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Erreur Discord pour le salon ${gameObject.channelId}:`, err.message);
                had429 = true;
            }
        }

        // Système d'intervalle adaptatif
        if (had429) {
            currentInterval = Math.min(600, currentInterval * 1.5); // Ralentit si l'API bloque
            consecutiveSuccess = 0;
        } else {
            consecutiveSuccess++;
            if (consecutiveSuccess >= 3) {
                currentInterval = Math.max(300, currentInterval * 0.9); // Revient à 5 min au maximum
                consecutiveSuccess = 0;
            }
        }

        setTimeout(loop, currentInterval * 1000);
    }

    loop();
}

// ----------------- GESTION DES COMMANDES DISCORD -----------------
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // Commande standard de test
    if (message.content === "!ping") {
        return message.reply("🏓 Pong ! Le gestionnaire multi-stats est opérationnel !");
    }

    // Commande d'ajout : !gameadd #salon URL
    if (message.content.startsWith("!gameadd")) {
        const args = message.content.split(" ");
        const channel = message.mentions.channels.first();
        const robloxUrl = args.find(arg => arg.includes("roblox.com/games/"));

        if (!channel || !robloxUrl) {
            return message.reply("❌ Syntaxe incorrecte.\nExemple : `!gameadd #mon-salon https://www.roblox.com/games/123456/Nom-Du-Jeu`");
        }

        if (!robloxUrl.match(/roblox\.com\/games\/(\d+)/)) {
            return message.reply("❌ L'URL Roblox fournie semble invalide.");
        }

        // Vérifier si le salon est déjà utilisé par un autre jeu
        const existing = config.trackedGames.find(g => g.channelId === channel.id);
        if (existing) {
            return message.reply(`⚠️ Le salon ${channel} suit déjà un jeu Roblox. Supprime-le d'abord avec \`!gameremove\`.`);
        }

        const newGame = {
            channelId: channel.id,
            robloxUrl: robloxUrl,
            discordMessageId: null
        };

        config.trackedGames.push(newGame);
        saveConfig();

        message.reply(`🎮 Jeu ajouté ! Les statistiques vont apparaître et s'actualiser toutes les 5 minutes dans ${channel}.`);
        
        // Lance immédiatement le suivi pour ce nouveau jeu
        startTracking(newGame);
    }

    // Commande de suppression : !gameremove #salon
    if (message.content.startsWith("!gameremove")) {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply("❌ Syntaxe incorrecte. Exemple : `!gameremove #mon-salon`");

        const index = config.trackedGames.findIndex(g => g.channelId === channel.id);
        if (index === -1) return message.reply("❌ Aucun suivi actif n'est configuré dans ce salon.");

        config.trackedGames.splice(index, 1);
        saveConfig();

        return message.reply(`🗑️ Suivi supprimé avec succès pour le salon ${channel}. (Le message existant ne s'actualisera plus)`);
    }

    // Commande de liste : !gamelist
    if (message.content === "!gamelist") {
        if (config.trackedGames.length === 0) return message.reply("📭 Aucun jeu n'est suivi actuellement.");
        
        let text = "📋 **Liste des jeux surveillés :**\n";
        config.trackedGames.forEach((g, i) => {
            text += `${i + 1}. Salon: <#${g.channelId}> — [Lien du jeu](${g.robloxUrl})\n`;
        });
        return message.reply(text);
    }
});

// ----------------- DEMARRAGE DU BOT -----------------
client.once("ready", () => {
    console.log(`🤖 Bot en ligne sous le nom : ${client.user.tag}`);
    console.log(`📦 Chargement de ${config.trackedGames.length} suivi(s) actif(s)...`);
    
    // Relance les boucles de tous les jeux enregistrés dans config.json
    config.trackedGames.forEach(gameObject => {
        startTracking(gameObject);
    });
});

client.login(config.TOKEN);
