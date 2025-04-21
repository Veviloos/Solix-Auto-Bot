# Solix Depin Auto Bot

An automated bot for the Solix Depin dashboard that helps users claim tasks and earn points automatically.

## 🌟 Features

- Automatic login to Solix Depin dashboard
- Automatic task claiming
- Regular connection quality pings to maintain active status
- Tracking of point accumulation

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- Solix Depin account

## 🚀 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/airdropinsiders/Solix-Auto-Bot.git
   ```

2. Navigate to the project directory:
   ```bash
   cd Solix-Auto-Bot
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up your environment variables:
   - Create a `.env` file in the root directory
   - Add your Solix Depin credentials:
     ```
     SOLIX_EMAIL=your_email@example.com
     SOLIX_PASSWORD=your_password
     ```

## 🏃‍♀️ Usage

Start the bot with:

```bash
npm start
```

The bot will:
1. Log in to your Solix Depin account
2. Display your current points information
3. Check for available tasks and claim them
4. Continuously ping the connection quality endpoint to maintain activity
5. Periodically check for new tasks (every 30 minutes)

To stop the bot, press `Ctrl+C` in your terminal.

## 📊 Console Output Guide

The bot provides detailed console output with color coding:

- 🟢 **Green**: Success messages
- 🟡 **Yellow**: Warnings or processing messages
- 🔴 **Red**: Error messages
- ⚪ **White**: Information and data
- 🔵 **Cyan**: Section headers

## ⚙️ Configuration

The bot uses the following intervals:
- Task checking: Every 30 minutes
- Connection pings: Every 1 minute

These can be modified in the code if needed.

## 📝 Note

This bot is for educational purposes. Please ensure you comply with Solix Depin's terms of service when using this tool.

## 🔒 Security

Never share your `.env` file or expose your credentials. The bot stores your login information locally and securely.

## 📜 License

MIT

## 🙏 Credits

Created by [Airdrop Insiders](https://github.com/airdropinsiders)