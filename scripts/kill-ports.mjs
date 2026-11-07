#!/usr/bin/env node
// Stops stuck Firebase emulator processes for THIS project.
//
// - Ports come from firebase.json (plus the Firestore UI websocket, 9150).
// - Only processes whose working directory is inside this project are touched,
//   so emulators from other projects on the default ports are left alone.
// - Sends SIGTERM first (lets the emulator export data), then SIGKILL after a grace period.
//
// Usage: npm run kill-ports [-- --force]   (--force skips straight to SIGKILL)

import { execFileSync } from 'node:child_process';
import { readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const graceMs = 8000;

const config = JSON.parse(readFileSync(join(projectDir, 'firebase.json'), 'utf8'));
const ports = new Set(
  Object.values(config.emulators ?? {})
    .map((e) => e?.port)
    .filter(Boolean),
);
ports.add(9150); // Firestore emulator UI websocket (not configurable in firebase.json)

function pidsOnPort(port) {
  try {
    const out = execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).map(Number);
  } catch {
    return []; // lsof exits 1 when nothing is listening
  }
}

function cwdOf(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return null;
  }
}

const isOurs = (cwd) => cwd === projectDir || cwd?.startsWith(projectDir + sep);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const targets = new Map(); // pid -> ports
for (const port of ports) {
  for (const pid of pidsOnPort(port)) {
    const cwd = cwdOf(pid);
    if (!isOurs(cwd)) {
      console.log(`port ${port}: pid ${pid} belongs to ${cwd ?? 'unknown'}, skipping`);
      continue;
    }
    targets.set(pid, [...(targets.get(pid) ?? []), port]);
  }
}

if (targets.size === 0) {
  console.log(`Nothing of ours is listening on ${[...ports].join(', ')}.`);
  process.exit(0);
}

const signal = force ? 'SIGKILL' : 'SIGTERM';
for (const [pid, p] of targets) {
  console.log(`${signal} pid ${pid} (ports ${p.join(', ')})`);
  try {
    process.kill(pid, signal);
  } catch {}
}

if (!force) {
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline && [...targets.keys()].some(alive)) {
    await new Promise((r) => setTimeout(r, 250));
  }
  for (const pid of targets.keys()) {
    if (alive(pid)) {
      console.log(`pid ${pid} still running after ${graceMs / 1000}s, sending SIGKILL`);
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
}

const left = [...ports].filter((port) => pidsOnPort(port).some((pid) => isOurs(cwdOf(pid))));
console.log(left.length ? `Still in use: ${left.join(', ')}` : 'All emulator ports are free.');
process.exit(left.length ? 1 : 0);
