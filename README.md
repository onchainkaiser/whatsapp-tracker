# Whatsapp Tracker 

A WhatsApp message analytics tool that tracks how often you use emojis and words in your outgoing messages — displayed as a Nigerian bank transfer receipt, because why not.

## What it does

- Connects to your WhatsApp account via [whatsapp-web.js](https://wwebjs.dev/)
- Logs every message you send to a local SQLite database
- Tracks:
  - All-time emoji frequency
  - All-time word frequency (with stopwords filtered out)
  - Monthly breakdown — top emoji, top word, and active messaging span for the current month
- Displays everything on a styled dashboard, designed to look like an Opay/Moniepoint-style transaction receipt

## Tech Stack

- **Node.js** — runtime
- **whatsapp-web.js** — WhatsApp connection and message events
- **Express** — dashboard server
- **better-sqlite3** — message storage
- **emoji-regex** — emoji detection
- **stopword** — filters common English words out of word-frequency counts

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/onchainkaiser/whatsapp-tracker.git
   cd whatsapp-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run it:
   ```bash
   node app.js
   ```

4. Scan the QR code that appears in your terminal with **WhatsApp → Settings → Linked Devices → Link a Device**.

5. Once connected, visit `http://localhost:3000` to see your dashboard.

## Routes

| Route | What it shows |
|---|---|
| `/` | The full receipt — all-time stats + current month |
| `/?month=YYYY-MM` | Stats for a specific past month |
| `/qr` | A scannable QR code image, for relinking WhatsApp after deployment (when you don't have direct terminal access) |

## Notes

- Only tracks messages **you send** — not incoming messages.
- Contact name resolution was attempted but abandoned due to instability in `whatsapp-web.js`'s `getChat()` method on the current WhatsApp Web version. Per-contact breakdown may be revisited later.
- Session credentials (`session/`) and message data (`messages.db`) are gitignored — never commit these, they contain live login credentials and private message content.

## Disclaimer

This is not a real bank. Please seek real financial advice elsewhere.