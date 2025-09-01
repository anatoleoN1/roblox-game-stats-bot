# Roblox Stats → Discord Webhook Bot

![Node.js CI](https://img.shields.io/badge/node-%3E%3D18-green)  
![Version](https://img.shields.io/badge/version-1.2.30-blue)  
![License](https://img.shields.io/badge/license-CC--BY%204.0-yellow)

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
- inquerer (come with Node.js)

---

## Installation and Usage

### Linux / Chromebook
1. Open the terminal.  
2. Install Node.js and npm:  
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm

3. check versions:
   ```bash
   node -v
   npm -v

4. Clone the repository:
   ```bash
   git clone https://github.com/anatoleoN1/roblox-game-stats-bot
   cd roblox-game-stats-bot

5. Install dependencies:
   ```bash
   npm install inquirer

6. Run the bot:
   ```bash
   node bot.js

---

### WINDOWS
1. Install [Node.js](https://nodejs.org/en/download/?utm_source=chatgpt.com)
 (choose the LTS version).
2. Open Command Prompt or PowerShell.
3. Clone the repository:
   ```powershell
   git clone https://github.com/anatoleoN1/roblox-game-stats-bot
   cd roblox-game-stats-bot

4. Install dependencies:
   ```powershell
   npm install
   npm install inquirer

5. Run the bot:
   ```powershell
   node bot.js

---

### MacOS
1. Install Node.js and npm using Homebrew (if not already installed):  
   ```bash
   brew install node

2. check versions:
   ```bash
   node -v
   npm -v

3. Clone the repository:
   ```bash
   git clone https://github.com/anatoleoN1/roblox-game-stats-bot
   cd roblox-game-stats-bot

4. Install dependencies:
   ```bash
   npm install inquirer

5. Run the bot:
   ```bash
   node bot.js

---

## Configuration
- Refresh interval: change the REFRESH_INTERVAL constant in bot.js (default is 5 seconds).
- Error handling: if Roblox API is unavailable, the bot shows N/A instead of crashing.

---

## Example
Title: Live Stats — Vorton Alpha
- Players Online: 123
- Visits: 42,000
- Favorites: 900
Footer: created by @anatoleo, powered by IA. V1.2.11

---
## UPDATES
#### 1.2.30
added update check function

#### 1.2.20
added a function to reuse an old message

#### 1.2.11
added a graphical interface to find bugs more easily

#### 1.2.10
3 bug fix:
- crash bug
- internet bug
- speed bug

### 1.2
added inquerer for:
- choose game URL
- choose webhook URl
sent message interface changed

#### 1.1.3
server-based bot project, abandoned

### 1.1
bot deployment

#### 1.0.9
modifying the bot to prepare it for deployment

### 1
creation of the bot

---

## License
Roblox Stats Discord Bot © 2025 by Anatoleo is licensed under CC BY 4.0. To view a copy of this license, visit https://creativecommons.org/licenses/by/4.0/
