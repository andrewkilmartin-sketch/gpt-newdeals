import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const AUDIT_SCRIPT = path.join(__dirname, 'scheduled-audit.ts');
const ALERT_LOG = path.join(process.cwd(), 'data', 'audit-alerts.log');

function logAlert(message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.error(logEntry);
  try {
    const dir = path.dirname(ALERT_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(ALERT_LOG, logEntry);
  } catch (e) {
    console.error('Failed to write alert log:', e);
  }
}

function runAudit(): Promise<number> {
  return new Promise((resolve) => {
    console.log(`\n[${new Date().toISOString()}] Starting scheduled audit...`);
    
    const child = spawn('npx', ['tsx', AUDIT_SCRIPT], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      const exitCode = code ?? 1;
      if (exitCode === 0) {
        console.log(`[${new Date().toISOString()}] Audit PASSED`);
      } else {
        logAlert(`AUDIT FAILED - Pass rate below threshold (exit code: ${exitCode})`);
      }
      resolve(exitCode);
    });

    child.on('error', (err) => {
      logAlert(`AUDIT CRASHED: ${err.message}`);
      resolve(1);
    });
  });
}

function scheduleNextAudit(): void {
  const nextRun = new Date(Date.now() + SIX_HOURS_MS);
  console.log(`\n[Scheduler] Next audit scheduled for: ${nextRun.toISOString()}`);
  
  setTimeout(async () => {
    try {
      await runAudit();
    } catch (error) {
      console.error('[Scheduler] Audit error:', error);
    }
    scheduleNextAudit();
  }, SIX_HOURS_MS);
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('AUDIT SCHEDULER STARTED');
  console.log(`Interval: Every 6 hours`);
  console.log(`Alert Threshold: 90% pass rate`);
  console.log('='.repeat(60));
  
  console.log('\n[Scheduler] Running initial audit...');
  await runAudit();
  
  scheduleNextAudit();
  
  console.log('\n[Scheduler] Running in background. Press Ctrl+C to stop.');
}

main().catch(console.error);
