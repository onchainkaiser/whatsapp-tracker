const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
});

const qrcode = require('qrcode-terminal');
const fs = require('fs');
const db = require('./db.js');
let cryCount = 0;

const countFile = './count.json';

if (fs.existsSync(countFile)) {
    const  data = fs.readFileSync(countFile, 'utf8');
    cryCount = JSON.parse(data).cryCount;
}

function saveCount() {
  fs.writeFileSync(countFile, JSON.stringify({ cryCount }));
}

client.on('qr', (qr) => {
    console.log('Scan this qr code with WhatsApp (Linked Devices):')
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Connected. Listening for messages... ');
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