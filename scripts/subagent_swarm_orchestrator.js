import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const STATE_FILE = path.join(process.cwd(), '.omg', 'state', 'shared_context.jsonl');
const MAX_RETRIES = 3;

function appendStateLog(agent, status, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    worker_id: `worker-${process.pid}`,
    agent,
    status,
    payload
  };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.appendFileSync(STATE_FILE, JSON.stringify(entry) + '\n');
}

async function runSubagentSwarm() {
  console.log('\n🐝 Triggering Pre-Commit Subagent Swarm Execution Pipeline...\n');

  // Step 1: Tier 1 Deterministic Fast Gate - Type Check
  console.log('🔹 [Gate 1] Executing Tier 1 Type Check (tsc --noEmit)...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    appendStateLog('tier1-gate', 'PASS', { check: 'tsc --noEmit' });
    console.log('   ✅ Tier 1 Type Check Passed.');
  } catch (err) {
    appendStateLog('tier1-gate', 'FAIL', { error: 'TypeScript compilation failed.' });
    console.error('   ❌ Tier 1 Failed! Fix compilation errors before committing.');
    process.exit(1);
  }

  // Step 2: Frontend Vitest Test Suite
  console.log('\n🔹 [Gate 2] Executing Frontend Vitest Test Suite (npm test)...');
  try {
    execSync('npm test -- --run', { stdio: 'pipe' });
    appendStateLog('vitest-gate', 'PASS', { check: 'npm test' });
    console.log('   ✅ Frontend Vitest Suite Passed.');
  } catch (err) {
    appendStateLog('vitest-gate', 'FAIL', { error: 'Vitest tests failed.' });
    console.error('   ❌ Vitest Suite Failed! Fix tests before committing.');
    process.exit(1);
  }

  // Step 3: Backend Pytest Test Suite
  console.log('\n🔹 [Gate 3] Executing Backend Pytest Test Suite...');
  try {
    // Set PYTHONPATH to server folder to match the pyproject.toml setting
    const env = { ...process.env, PYTHONPATH: 'server' };
    const pythonPath = path.join('server', '.venv', 'Scripts', 'python.exe');
    const cmd = fs.existsSync(pythonPath) 
      ? `"${pythonPath}" -m pytest server/tests`
      : 'pytest server/tests';
    
    execSync(cmd, { stdio: 'pipe', env });
    appendStateLog('pytest-gate', 'PASS', { check: 'pytest' });
    console.log('   ✅ Backend Pytest Suite Passed.');
  } catch (err) {
    appendStateLog('pytest-gate', 'FAIL', { error: 'Pytest tests failed.' });
    console.error('   ❌ Pytest Suite Failed! Fix tests before committing.');
    process.exit(1);
  }

  // Step 4: ChromeDevTools CDP Connection Check (Optional, warning only)
  console.log('\n🔹 [Gate 4] ChromeDevTools CDP Port 9222 Connection Check...');
  try {
    const http = await import('http');
    await new Promise((resolve, reject) => {
      const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
        if (res.statusCode === 200) resolve();
        else reject();
      });
      req.on('error', reject);
      req.setTimeout(500, () => {
        req.destroy();
        reject();
      });
    });
    appendStateLog('chromedevtools-gate', 'PASS', { check: 'cdp port 9222' });
    console.log('   ✅ ChromeDevTools CDP port 9222 is active and responsive.');
  } catch (err) {
    appendStateLog('chromedevtools-gate', 'WARN', { check: 'cdp port 9222 inactive' });
    console.log('   ⚠️ ChromeDevTools CDP on port 9222 is not running (Skipped E2E visual check).');
  }

  console.log('\n🎉 ALL SUBAGENT HOOKS PASSED! Commit approved for git history.\n');
}

runSubagentSwarm().catch(err => {
  console.error('Subagent Swarm Error:', err);
  process.exit(1);
});
