# Roblox Stats → Discord Webhook Bot

A Node.js bot that tracks live statistics of any Roblox game and posts them into a Discord channel via a webhook.  
The bot automatically refreshes every few seconds and updates the same Discord message instead of creating new ones.  

---

## Features
- Fetches live stats: players online, visits, favorites.  
- Auto-refresh (default: every 5 seconds).  
- Updates the same Discord message in real time.  
- Uses the Roblox game name and icon as bot profile.  
- Error handling (timeouts, missing data, API errors).  
- Interactive setup via terminal prompts.  
- Works with any Roblox game (just provide the URL).  

---

## Requirements
- Node.js 18+  
- npm (comes with Node.js)  

---

## Installation and Usage

### Linux / Chromebook
1. Open the terminal.  
2. Install Node.js and npm:  
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm
