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
  const action = process.argv[2] || 'status';
  const pages = await getJson('http://127.0.0.1:9222/json');
  const targetPage = pages.find(p => p.type === 'page' && p.url.includes('5173'));

  if (!targetPage) {
    console.error("❌ Edge page not found on 5173.");
    process.exit(1);
  }

  const wsUrl = targetPage.webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));

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

  if (action === 'select-hr-admin') {
    console.log("👉 Selecting HR Admin Role in Edge...");
    await evalJs(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('HR Admin'));
      if (btn) {
        btn.style.outline = '4px solid #F2994A';
        btn.style.boxShadow = '0 0 15px #F2994A';
        btn.click();
      }
    `);
  } else if (action === 'select-preboardee') {
    console.log("👉 Selecting Preboardee Role in Edge...");
    await evalJs(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Preboardee'));
      if (btn) {
        btn.style.outline = '4px solid #2BC4D9';
        btn.click();
      }
    `);
  } else if (action === 'authenticate') {
    console.log("👉 Submitting Authenticate in Edge...");
    await evalJs(`
      const authBtn = document.querySelector('form button');
      if (authBtn) {
        authBtn.style.outline = '4px solid #0E8A9A';
        authBtn.click();
      }
    `);
  } else if (action === 'goto-checklist') {
    console.log("👉 Navigating to Onboarding Checklist...");
    await evalJs(`window.location.hash = '#/checklist'`);
  } else if (action === 'copy-slack') {
    console.log("👉 Testing Buddy Card & Copying Slack Template...");
    await evalJs(`
      const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Copy Slack Template') || b.innerText.includes('Slack'));
      if (copyBtn) {
        copyBtn.style.outline = '4px solid #C65D00';
        copyBtn.click();
      }
    `);
  } else if (action === 'goto-scheduler') {
    console.log("👉 Navigating to Team Hybrid Scheduler...");
    await evalJs(`window.location.hash = '#/admin/scheduler'`);
  } else if (action === 'highlight-save') {
    console.log("👉 Highlighting Save Changes Controls...");
    await evalJs(`
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Changes'));
      if (saveBtn) {
        saveBtn.style.outline = '4px solid #0B2A3D';
      }
    `);
  }

  await sleep(1000);
  ws.close();
}

run().catch(console.error);
