import type { Lab } from './convert.ts';

/**
 * CIEDE2000 color difference. This is the metric the whole `sweep` command turns
 * on: it is perceptually uniform enough that a single ΔE cutoff is a defensible
 * way to ask "did the humans mean these to be the same color?".
 *
 * Implementation follows Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-
 * Difference Formula: Implementation Notes, Supplementary Test Data, and
 * Mathematical Observations".
 */
export function ciede2000(a: Lab, b: Lab): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.hypot(a.a, a.b);
  const C2 = Math.hypot(b.a, b.b);
  const Cbar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a.a;
  const a2p = (1 + G) * b.a;

  const C1p = Math.hypot(a1p, a.b);
  const C2p = Math.hypot(a2p, b.b);

  const h1p = hp(a.b, a1p);
  const h2p = hp(b.b, a2p);

  const dLp = b.L - a.L;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (a.L + b.L) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    (dLp / (kL * Sl)) ** 2 +
      (dCp / (kC * Sc)) ** 2 +
      (dHp / (kH * Sh)) ** 2 +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

function hp(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0;
  const angle = (Math.atan2(b, ap) * 180) / Math.PI;
  return angle >= 0 ? angle : angle + 360;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
