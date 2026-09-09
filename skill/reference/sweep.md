# sweep

The CIEDE2000 ΔE cutoff sweep. Cluster the extracted colours at every ΔE across a
range; emit the full curve — including where it does not stabilise, because that
is what tells you whether ΔE is a sane merge metric for this palette.

```bash
<skill-base-dir>/bin/ds-ops sweep <fixture> --out <dir>
```

`--out` writes `<label>.sweep.json` + `.md` — a calibration row.

## Reading the curve

- **Monotone non-increasing** — necessary. If the curve rises anywhere, clustering
  is unstable and ΔE is the wrong metric (or the extractor is double-counting).
- **Intent plateau** — a band where the cluster count holds within ~15% of the
  shipped primitive count. Its presence means the palette was hand-tuned to a
  deliberate set of "these are the same" decisions. Its absence means a generated
  even scale, or a ramp finer than one just-noticeable-difference.
- **There is no global cutoff.** Radix's light scales want ΔE ≤ 0.75; a hand-built
  product palette wants ≈ 1.1. Run the sweep per source, always. ΔE 2.3 (the JND
  default) is a documented neutral, never a recommendation.

## Publishing a number

Always with its curve and its failure mode. "Palette knee is ΔE 0.75–1.5" invites
"my library is the exception"; the curve plus a contrasting example that has no
knee does not.
