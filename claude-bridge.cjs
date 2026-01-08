/**
 * ════════════════════════════════════════════════════════════════════
 * CLAUDE ↔ REPLIT BRIDGE v1.0
 * ════════════════════════════════════════════════════════════════════
 * 
 * SETUP (one time):
 * 1. Save this as: claude-bridge.js
 * 1. Create file: claude-input.json (paste Claude's instructions here)
 * 1. Run: node claude-bridge.js
 * 
 * WORKFLOW:
 * 1. Claude gives you JSON → paste into claude-input.json
 * 1. This script auto-runs it
 * 1. Copy claude-output.json → paste to Claude
 * 1. Repeat!
 * 
 * ════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const { execSync } = require('child_process');

const INPUT = './claude-input.json';
const OUTPUT = './claude-output.json';
const API = process.env.BASE_URL || 'http://localhost:5000';

// Create input file if missing
if (!fs.existsSync(INPUT)) {
  fs.writeFileSync(INPUT, '{"action":"waiting"}');
}

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🤖 CLAUDE ↔ REPLIT BRIDGE ACTIVE                             ║
║                                                               ║
║  Input:  ${INPUT.padEnd(50)}║
║  Output: ${OUTPUT.padEnd(50)}║
║  API:    ${API.padEnd(50)}║
╚═══════════════════════════════════════════════════════════════╝

Watching for Claude's instructions…
`);

let lastHash = '';

async function run() {
  try {
    const raw = fs.readFileSync(INPUT, 'utf8');
    const hash = Buffer.from(raw).toString('base64').slice(0, 20);

    if (hash === lastHash) return;
    lastHash = hash;

    const input = JSON.parse(raw);
    if (input.action === 'waiting') return;

    console.log(`\n⚡ Running: ${input.action}`);

    const result = await execute(input);

    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
    console.log(`✅ Done → ${OUTPUT}`);

  } catch (e) {
    fs.writeFileSync(OUTPUT, JSON.stringify({ error: e.message }, null, 2));
  }
}

async function execute(input) {
  const out = { action: input.action, time: new Date().toISOString(), ok: false };

  switch (input.action) {

    case 'health':
      out.data = await api('/sunny/health');
      out.ok = true;
      break;

    case 'chat':
      out.data = await api('/sunny/chat', { message: input.message });
      out.ok = out.data?.success;
      break;

    case 'conversation':
      out.data = [];
      for (const msg of input.messages) {
        const r = await api('/sunny/chat', { message: msg });
        out.data.push({ user: msg, sunny: r.response, debug: r.debug });
        await sleep(300);
      }
      out.ok = true;
      break;

    case 'test-all':
      out.data = await runTests();
      out.ok = out.data.failed === 0;
      break;

    case 'test-one':
      out.data = await runSingleTest(input.test);
      out.ok = out.data.pass;
      break;

    case 'api-check':
      out.data = await api(input.endpoint);
      out.ok = true;
      break;

    case 'read':
      out.data = fs.readFileSync(input.file, 'utf8');
      out.ok = true;
      break;

    case 'write':
      fs.writeFileSync(input.file, input.content);
      out.ok = true;
      out.data = { wrote: input.file };
      break;

    case 'shell':
      try {
        out.data = execSync(input.cmd, { encoding: 'utf8', timeout: 30000 });
        out.ok = true;
      } catch (e) {
        out.data = e.stderr || e.message;
      }
      break;

    case 'full-test':
      out.data = await fullUserTest();
      out.ok = out.data.issues === 0;
      break;
      
    default:
      out.error = `Unknown: ${input.action}`;
  }

  return out;
}

async function api(endpoint, body = null) {
  const opts = { headers: { 'Content-Type': 'application/json' } };
  if (body) {
    opts.method = 'POST';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(`${API}${endpoint}`, opts);
  return r.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

async function runTests() {
  const tests = [
    ['health', async () => (await api('/sunny/health')).version?.includes('v2')],
    ['greeting', async () => (await api('/sunny/chat', { message: 'Hi' })).success],
    ['safari', async () => {
      const r = await api('/sunny/chat', { message: 'Safari parks Birmingham' });
      return r.response?.toLowerCase().includes('kids pass');
    }],
    ['cinema', async () => {
      const r = await api('/sunny/chat', { message: "What's on at cinema" });
      return r.response?.toLowerCase().includes('kids pass');
    }],
    ['movie-night', async () => {
      const r = await api('/sunny/chat', { message: 'Netflix film tonight' });
      return !r.response?.includes('kidspass.co.uk/cinema'); // Should NOT show cinema promo
    }],
    ['no-hallucinate', async () => {
      const r = await api('/sunny/chat', { message: 'Safari parks Midlands' });
      const apiNames = r.debug?.apiResults?.flatMap(x => x.names || []) || [];
      const mentions = r.response?.match(/Longleat|Whipsnade|Chester/gi) || [];
      return mentions.every(m => apiNames.some(n => n?.toLowerCase().includes(m.toLowerCase())));
    }],
    ['restaurants', async () => {
      const r = await api('/sunny/chat', { message: 'Places to eat with kids' });
      return r.response?.toLowerCase().includes('kids pass');
    }],
    ['theme-parks', async () => {
      const r = await api('/sunny/chat', { message: 'Theme parks near London' });
      return r.response?.toLowerCase().includes('kids pass');
    }]
  ];

  const results = { passed: 0, failed: 0, details: [] };

  for (const [name, fn] of tests) {
    try {
      const pass = await fn();
      results.details.push({ name, pass });
      pass ? results.passed++ : results.failed++;
    } catch (e) {
      results.details.push({ name, pass: false, error: e.message });
      results.failed++;
    }
  }

  return results;
}

async function runSingleTest(name) {
  const r = await api('/sunny/chat', { message: name });
  return {
    pass: r.success,
    response: r.response?.substring(0, 500),
    debug: r.debug
  };
}

// ═══════════════════════════════════════════════════════════════
// FULL USER SIMULATION
// ═══════════════════════════════════════════════════════════════

async function fullUserTest() {
  const users = [
    { name: 'Sarah', msgs: ['Hi', 'Soft play Birmingham', 'Actually staying in, whats on Netflix?'] },
    { name: 'Dave', msgs: ['Theme parks near London with deals'] },
    { name: 'Emma', msgs: ['Places to eat with kids Manchester'] },
    { name: 'Tom', msgs: ['Film for tonight on Disney plus', 'What snacks should we get?'] },
    { name: 'Lisa', msgs: ['Safari parks near me'] }
  ];

  const results = { users: [], issues: 0, hallucinations: [] };

  for (const u of users) {
    const convos = [];
    for (const m of u.msgs) {
      const r = await api('/sunny/chat', { message: m });

      // Check for hallucinations
      const apiNames = r.debug?.apiResults?.flatMap(x => x.names?.map(n => n.toLowerCase()) || []) || [];
      const badMentions = ['longleat', 'alton towers', 'thorpe park', 'chessington', 'legoland'];
      
      for (const bad of badMentions) {
        if (r.response?.toLowerCase().includes(bad) && !apiNames.some(n => n.includes(bad))) {
          results.hallucinations.push({ user: u.name, mentioned: bad, apiHad: apiNames });
          results.issues++;
        }
      }
      
      convos.push({
        user: m,
        sunny: r.response?.substring(0, 300) + (r.response?.length > 300 ? '...' : ''),
        intents: r.debug?.intents?.map(i => i.type),
        apiNames: apiNames.slice(0, 5)
      });
      
      await sleep(200);
    }
    results.users.push({ name: u.name, convos });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// WATCH LOOP
// ═══════════════════════════════════════════════════════════════

setInterval(run, 1500);
run();
