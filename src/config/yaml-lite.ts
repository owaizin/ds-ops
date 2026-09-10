/**
 * A dependency-free reader for the small YAML subset a ds-loop config uses:
 * nested maps by 2-space indent, `key: scalar`, `key:` map headers, `#` comments,
 * quoted/unquoted strings, true/false/null, numbers, and inline `[]` lists.
 *
 * Deliberately NOT a general YAML parser — the analyzer stays zero-dependency and
 * config parsing at startup does not warrant pulling one in.
 */
export function parseYamlLite(text: string): unknown {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\t/g, '  '))
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));

  const root: Record<string, unknown> = {};
  // stack of { indent, container }
  const stack: { indent: number; node: Record<string, unknown> }[] = [{ indent: -1, node: root }];

  for (const rawLine of lines) {
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = stripInlineComment(rawLine.trim());
    const colon = line.indexOf(':');
    if (colon === -1) continue; // block lists unsupported — his config has none

    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) stack.pop();
    const parent = stack[stack.length - 1]!.node;

    if (rest === '') {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  return root;
}

function stripInlineComment(s: string): string {
  // strip ` # comment` but not a `#` inside quotes
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble && (i === 0 || s[i - 1] === ' ')) {
      return s.slice(0, i).trim();
    }
  }
  return s;
}

function parseScalar(v: string): unknown {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~' || v === '') return null;
  if (v === '[]') return [];
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => parseScalar(s.trim()))
      .filter((s) => s !== null);
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
