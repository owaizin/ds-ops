import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `guard on` installs a PostToolUse hook in the project's .claude/settings.json.
 * After any Edit/Write to a style file, the hook runs `ds-loop audit` scoped to
 * that file and surfaces high-severity findings back to the agent. Other hooks
 * in the file are left untouched.
 *
 * Deterministic checks nag; they never block. A PostToolUse hook cannot undo the
 * edit anyway — it just adds a note.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HOOK_SCRIPT = join(REPO_ROOT, 'skill', 'hooks', 'ds-loop-guard.mjs');
const HOOK_COMMAND = `node ${JSON.stringify(HOOK_SCRIPT)}`;
const MATCHER = 'Edit|Write|MultiEdit';

type HookEntry = { type: string; command: string };
type Matcher = { matcher?: string; hooks: HookEntry[] };
type Settings = { hooks?: Record<string, Matcher[]> } & Record<string, unknown>;

function settingsPath(): string {
  return join(process.cwd(), '.claude', 'settings.json');
}

function readSettings(): Settings {
  const p = settingsPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Settings;
  } catch {
    throw new Error(`${p} is not valid JSON — fix it by hand before running guard`);
  }
}

function isOurs(h: HookEntry): boolean {
  return h.command.includes('ds-loop-guard.mjs');
}

export function guard(action: 'on' | 'off' | 'status'): void {
  const p = settingsPath();
  const settings = readSettings();
  const postToolUse = settings.hooks?.PostToolUse ?? [];
  const installed = postToolUse.some((m) => m.hooks?.some(isOurs));

  if (action === 'status') {
    console.log(`\n  ds-loop guard`);
    console.log(`  settings: ${p}${existsSync(p) ? '' : ' (does not exist yet)'}`);
    console.log(`  installed: ${installed ? 'yes' : 'no'}`);
    if (installed) console.log(`  hook: ${HOOK_COMMAND}`);
    console.log('');
    return;
  }

  if (action === 'off') {
    if (!installed) {
      console.log('  ds-loop guard: not installed, nothing to remove.');
      return;
    }
    const cleaned = postToolUse
      .map((m) => ({ ...m, hooks: m.hooks.filter((h) => !isOurs(h)) }))
      .filter((m) => m.hooks.length > 0);
    settings.hooks = { ...settings.hooks, PostToolUse: cleaned };
    if (cleaned.length === 0) delete settings.hooks.PostToolUse;
    write(settings);
    console.log('  ds-loop guard: removed. Other hooks left in place.');
    return;
  }

  // action === 'on'
  if (installed) {
    console.log('  ds-loop guard: already installed. `guard off` to remove.');
    return;
  }
  const entry: Matcher = { matcher: MATCHER, hooks: [{ type: 'command', command: HOOK_COMMAND }] };
  settings.hooks = { ...settings.hooks, PostToolUse: [...postToolUse, entry] };
  write(settings);
  console.log(`\n  ds-loop guard: installed in ${p}`);
  console.log(`  After any Edit/Write to a .css file, ds-loop audits that file and`);
  console.log(`  reports high-severity findings. It never blocks the edit.`);
  console.log(`  Restart the agent session for the hook to take effect.\n`);
}

function write(settings: Settings): void {
  const dir = join(process.cwd(), '.claude');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`);
}
