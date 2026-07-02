const http = require('http');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function run() {
  console.log("🔍 Finding visible Edge tab...");
  const pages = await getJson('http://127.0.0.1:9222/json');
  const targetPage = pages.find(p => p.type === 'page' && p.url.includes('5173'));

  if (!targetPage) {
    console.error("❌ Could not find Edge page listening on 5173!");
    process.exit(1);
  }

  const wsUrl = targetPage.webSocketDebuggerUrl;
  console.log("🔗 Connecting to Edge CDP WebSocket:", wsUrl);

  const ws = new WebSocket(wsUrl);

  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  console.log("✅ Connected to Edge! Starting live visible interactions...");

  let messageId = 1;
  function sendCdp(method, params = {}) {
    return new Promise(resolve => {
      const id = messageId++;
      const handler = event => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalJs(code) {
    return await sendCdp('Runtime.evaluate', { expression: code });
  }

  // 1. Highlight and click HR Admin Quick Login
  console.log("👉 1. Selecting HR Admin role...");
  await evalJs(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('HR Admin'));
    if (btn) {
      btn.style.outline = '4px solid #F2994A';
      btn.click();
    }
  `);
  await sleep(2500);

  // 2. Click Authenticate button
  console.log("👉 2. Clicking Authenticate button...");
  await evalJs(`
    const authBtn = document.querySelector('form button');
    if (authBtn) {
      authBtn.style.outline = '4px solid #0E8A9A';
      authBtn.click();
    }
  `);
  await sleep(3500);

  // 3. Navigate to Onboarding Checklist
  console.log("👉 3. Navigating to Onboarding Checklist...");
  await evalJs(`window.location.hash = '#/checklist'`);
  await sleep(3500);

  // 4. Highlight Buddy Profile Card and Copy Slack Template
  console.log("👉 4. Testing Buddy Profile Card & Slack Template Copy...");
  await evalJs(`
    const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Copy Slack Template') || b.innerText.includes('Slack'));
    if (copyBtn) {
      copyBtn.style.outline = '4px solid #C65D00';
      copyBtn.click();
    }
  `);
  await sleep(3500);

  // 5. Navigate to Team Hybrid Scheduler
  console.log("👉 5. Navigating to Team Hybrid Scheduler...");
  await evalJs(`window.location.hash = '#/admin/scheduler'`);
  await sleep(3500);

  // 6. Demonstrate Save/Discard Controls
  console.log("👉 6. Highlighting Save Changes and Discard controls...");
  await evalJs(`
    const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Changes'));
    if (saveBtn) {
      saveBtn.style.outline = '4px solid #0B2A3D';
    }
  `);
  await sleep(3000);

  console.log("🎉 Live Edge automation walkthrough complete!");
  ws.close();
}

run().catch(console.error);
