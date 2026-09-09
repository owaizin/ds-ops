import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import type { SourceRef } from '../adapters/types.ts';
import { type FixtureMeta, loadFixture } from './fixture.ts';

/**
 * Resolve a CLI target into a { meta, source } pair.
 *
 *  - a directory holding a SOURCE.json  -> frozen fixture (comparable, reproducible)
 *  - any other directory or a .css file -> live scan of the working tree
 *
 * Live scans have no ground-truth primitive count and their `fixtureSha` is the
 * git HEAD of the repo (or `live` when not in git), so a calibration row taken
 * from a live scan still records exactly what it looked at.
 */
export function resolveSource(
  target: string,
  opts: { only?: string[] } = {},
): { meta: FixtureMeta; source: SourceRef; live: boolean } {
  const abs = isAbsolute(target) ? target : resolve(process.cwd(), target);

  if (!existsSync(abs)) throw new Error(`path not found: ${abs}`);

  const isDir = statSync(abs).isDirectory();
  if (isDir && existsSync(join(abs, 'SOURCE.json'))) {
    const { meta, source } = loadFixture(target);
    return { meta, source: withOnly(source, opts.only), live: false };
  }

  const repoRoot = gitRoot(isDir ? abs : resolve(abs, '..'));
  const sha = repoRoot ? gitHead(repoRoot) : null;
  const meta: FixtureMeta = {
    label: basename(repoRoot ?? abs) || 'live',
    upstream: repoRoot ? `git working tree at ${repoRoot}` : abs,
    fixtureSha: sha ? `git:${sha}` : 'live',
    retrievedAt: new Date().toISOString().slice(0, 10),
    path: '.',
    shippedPrimitiveCount: null,
    notes: 'live scan of the working tree — not a frozen snapshot',
  };
  const source: SourceRef = { root: abs, fixtureSha: meta.fixtureSha, label: meta.label };
  return { meta, source: withOnly(source, opts.only), live: true };
}

function withOnly(source: SourceRef, only: string[] | undefined): SourceRef {
  if (!only || only.length === 0) return source;
  return { ...source, only: only.map((f) => (isAbsolute(f) ? f : resolve(process.cwd(), f))) };
}

/** files changed vs a git ref, filtered to what an adapter can read */
export function changedFiles(ref: string, cwd = process.cwd()): string[] {
  const root = gitRoot(cwd);
  if (!root) return [];
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter(Boolean)
      .map((f) => join(root, f));
  } catch {
    return [];
  }
}

function gitRoot(from: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: from, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function gitHead(root: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().slice(0, 12);
  } catch {
    return null;
  }
}
