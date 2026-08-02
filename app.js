const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const express = require('express');
const emojiRegex = require('emoji-regex');
const sw = require('stopword');
const db = require('./db.js');

// ---------- WHATSAPP LISTENER ----------

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './data/session' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let cryCount = 0;
let latestQr = null;
const countFile = './data/count.json';

if (fs.existsSync(countFile)) {
  const data = fs.readFileSync(countFile, 'utf8');
  cryCount = JSON.parse(data).cryCount;
}

function saveCount() {
  fs.writeFileSync(countFile, JSON.stringify({ cryCount }));
}

client.on('qr', (qr) => {
  console.log('Scan this qr code with WhatsApp (Linked Devices):');
  qrcode.generate(qr, { small: true });
  latestQr = qr;
});

client.on('ready', () => {
  console.log('WhatsApp connected. Listening for messages...');
  latestQr = null;
});

client.on('message', (msg) => {
  console.log(`[IN] ${msg.from}: ${msg.body}`);
});

client.on('message_create', (msg) => {
  if (msg.fromMe) {
    console.log(`[OUT] ${msg.to}: ${msg.body}`);

    db.prepare('INSERT INTO messages (chat_id, body, timestamp) VALUES (?, ?, ?)')
      .run(msg.to, msg.body, msg.timestamp);

    const matches = msg.body.match(/😭/g);
    if (matches) {
      cryCount += matches.length;
      saveCount();
      console.log(`😭 count: ${cryCount}`);
    }
  }
});

client.initialize();

// ---------- DASHBOARD SERVER ----------

const app = express();

function randomRef() {
  return 'CRY' + Math.floor(100000000 + Math.random() * 900000000);
}

function analyzeMessages(rows) {
  let localCryCount = 0;
  const emojiCounts = {};
  const wordCounts = {};

  for (const row of rows) {
    const cryMatches = row.body.match(/😭/g);
    if (cryMatches) localCryCount += cryMatches.length;

    const words = row.body
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    const filteredWords = sw.removeStopwords(words);
    for (const word of filteredWords) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }

    const allEmojis = row.body.match(emojiRegex());
    if (allEmojis) {
      for (const emoji of allEmojis) {
        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
      }
    }
  }

  const sortedEmojis = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]);
  const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return {
    cryCount: localCryCount,
    sortedEmojis,
    sortedWords,
    topEmoji: sortedEmojis.length > 0 ? sortedEmojis[0][0] : '—',
    topEmojiCount: sortedEmojis.length > 0 ? sortedEmojis[0][1] : 0,
  };
}

function buildRows(entries) {
  return entries
    .map(([label, count]) => `
      <div class="row">
        <span class="row-label">${label}</span>
        <span class="row-value">x${count}</span>
      </div>
    `)
    .join('');
}

app.get('/qr', async (req, res) => {
  if (!latestQr) {
    return res.send('No QR code needed right now — already connected, or none generated yet.');
  }
  const qrImage = await QRCode.toDataURL(latestQr);
  res.send(`
    <body style="display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#141210;">
      <div style="text-align:center;">
        <img src="${qrImage}" style="width:300px; border-radius:8px;">
        <p style="font-family:sans-serif; color:#fff; margin-top:16px;">Scan with WhatsApp → Linked Devices</p>
      </div>
    </body>
  `);
});

app.get('/', (req, res) => {
  const totalMessages = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;

  const allRows = db.prepare('SELECT body FROM messages').all();
  const allTime = analyzeMessages(allRows);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = req.query.month || defaultMonth;

  const monthRows = db.prepare(`
    SELECT body FROM messages
    WHERE strftime('%Y-%m', timestamp, 'unixepoch') = ?
  `).all(selectedMonth);

  const thisMonth = analyzeMessages(monthRows);

  const monthRange = db.prepare(`
    SELECT MIN(timestamp) AS first, MAX(timestamp) AS last
    FROM messages
    WHERE strftime('%Y-%m', timestamp, 'unixepoch') = ?
  `).get(selectedMonth);

  let timeSpanText = 'No data yet';
  if (monthRange.first && monthRange.last) {
    const spanSeconds = monthRange.last - monthRange.first;
    const days = Math.floor(spanSeconds / 86400);
    const hours = Math.floor((spanSeconds % 86400) / 3600);
    timeSpanText = `${days}d ${hours}h`;
  }

  const monthTopEmoji = thisMonth.topEmoji;
  const monthTopEmojiCount = thisMonth.topEmojiCount;
  const monthTopWord = thisMonth.sortedWords.length > 0 ? thisMonth.sortedWords[0][0] : '—';
  const monthTopWordCount = thisMonth.sortedWords.length > 0 ? thisMonth.sortedWords[0][1] : 0;

  const breakdownRows = buildRows(allTime.sortedEmojis);
  const wordRows = buildRows(allTime.sortedWords);

  const dateStr = now.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Transaction Successful</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --green: #00A651;
          --green-dark: #00863F;
          --ink: #1A1A1A;
          --gray: #8A8A8A;
          --line: #ECECEC;
          --bg: #E9EBEE;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 32px 16px;
        }
        .card {
          width: 380px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .status {
          background: linear-gradient(180deg, #ffffff 0%, #F6FBF8 100%);
          padding: 32px 24px 24px;
          text-align: center;
        }
        .check {
          width: 56px;
          height: 56px;
          background: var(--green);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .check svg { width: 28px; height: 28px; }
        .status h1 {
          font-size: 17px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 4px;
        }
        .status .sub {
          font-size: 13px;
          color: var(--gray);
        }
        .amount {
          text-align: center;
          padding: 4px 24px 24px;
        }
        .amount .figure {
          font-size: 40px;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: -0.02em;
        }
        .amount .figure .emoji {
          font-size: 32px;
        }
        .amount .caption {
          font-size: 12px;
          color: var(--gray);
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .divider {
          border: none;
          border-top: 1.5px dashed #D8D8D8;
          margin: 0;
          position: relative;
        }
        .divider::before, .divider::after {
          content: '';
          position: absolute;
          top: -10px;
          width: 20px;
          height: 20px;
          background: var(--bg);
          border-radius: 50%;
        }
        .divider::before { left: -34px; }
        .divider::after { right: -34px; }
        .section {
          padding: 20px 24px;
        }
        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--gray);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 12px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 0;
          font-size: 13.5px;
        }
        .row-label {
          color: var(--gray);
        }
        .row-value {
          color: var(--ink);
          font-weight: 600;
          text-align: right;
        }
        .footer {
          background: #FAFAFA;
          padding: 18px 24px 22px;
          text-align: center;
        }
        .footer .brand {
          font-size: 12px;
          font-weight: 700;
          color: var(--green-dark);
          letter-spacing: 0.02em;
        }
        .footer .fine {
          font-size: 10.5px;
          color: #B3B3B3;
          margin-top: 6px;
          line-height: 1.5;
        }
        .barcode {
          height: 36px;
          margin: 14px auto 0;
          width: 200px;
          background: repeating-linear-gradient(90deg, #1A1A1A 0px, #1A1A1A 2px, transparent 2px, transparent 5px, #1A1A1A 5px, #1A1A1A 6px, transparent 6px, transparent 9px);
          opacity: 0.85;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status">
          <div class="check">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1>Transaction Successful</h1>
          <div class="sub">${dateStr} · ${timeStr}</div>
        </div>

        <div class="amount">
          <div class="figure"><span class="emoji">${allTime.topEmoji}</span> ${allTime.topEmojiCount}</div>
          <div class="caption">Top emoji used (all-time)</div>
        </div>

        <hr class="divider">

        <div class="section">
          <p class="section-title">Transaction Details</p>
          <div class="row"><span class="row-label">Transaction Type</span><span class="row-value">Emotional Withdrawal</span></div>
          <div class="row"><span class="row-label">Reference No.</span><span class="row-value">${randomRef()}</span></div>
          <div class="row"><span class="row-label">Sender</span><span class="row-value">David</span></div>
          <div class="row"><span class="row-label">Receiver</span><span class="row-value">The Group Chat</span></div>
          <div class="row"><span class="row-label">Narration</span><span class="row-value">Re: Life</span></div>
          <div class="row"><span class="row-label">Total Messages Sent</span><span class="row-value">${totalMessages}</span></div>
        </div>

        <hr class="divider">

        <div class="section">
          <p class="section-title">Itemized Charges (All-Time)</p>
          ${breakdownRows || '<p style="font-size:13px; color:#B3B3B3;">No emojis logged yet</p>'}
        </div>

        <hr class="divider">

        <div class="section">
          <p class="section-title">Top Words Used (All-Time)</p>
          ${wordRows || '<p style="font-size:13px; color:#B3B3B3;">Not enough data yet</p>'}
        </div>

        <hr class="divider">

        <div class="section">
          <p class="section-title">${monthLabel}</p>
          <div class="row"><span class="row-label">Emoji of the Month</span><span class="row-value">${monthTopEmoji} (x${monthTopEmojiCount})</span></div>
          <div class="row"><span class="row-label">Word of the Month</span><span class="row-value">${monthTopWord} (x${monthTopWordCount})</span></div>
          <div class="row"><span class="row-label">Active Span</span><span class="row-value">${timeSpanText}</span></div>
        </div>

      <div class="footer">
          <div class="brand">DAVID'S MICROFINANCE BANK</div>
          <div class="fine">This receipt is proof of tears sent. Keep for your records.<br>Not a real bank. Please seek real financial advice elsewhere.</div>
          <div class="barcode"></div>
      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT}`);
});