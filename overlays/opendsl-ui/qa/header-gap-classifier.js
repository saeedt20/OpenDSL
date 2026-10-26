'use strict';
// Classifies a text-fragment rect against an action-box rect.
//
// Rules (guide §6 / independent review §3):
//  - genuine intersection on both axes => 'intersect'
//  - vertical overlap but disjoint horizontally => horizontal separation gap
//  - horizontal overlap but disjoint vertically => vertical separation gap
//  - no overlap on either axis (diagonal) => null (no clearance required)
// A gap < 8 px fails, including exactly touching edges (zero clearance).
// Rect args are {l,r,t,b} in CSS px (floats from DOM Range rects).
function classifyGap(f, ab) {
  const overlapX = f.r > ab.l + 0.5 && f.l < ab.r - 0.5;
  const overlapY = f.b > ab.t + 0.5 && f.t < ab.b - 0.5;
  if (overlapX && overlapY) return { kind: 'intersect' };
  if (overlapY) {
    const gap = Math.max(f.l, ab.l) - Math.min(f.r, ab.r);
    if (gap < 8) return { kind: 'h-gap', gap: +gap.toFixed(1) };
    return null;
  }
  if (overlapX) {
    const gap = Math.max(f.t, ab.t) - Math.min(f.b, ab.b);
    if (gap < 8) return { kind: 'v-gap', gap: +gap.toFixed(1) };
    return null;
  }
  return null;
}

// Negative/positive controls for the classifier. run() returns {pass, probes}.
function runNegativeControls() {
  const f = { l: 0, r: 10, t: 0, b: 20 };
  const cases = [
    { name: 'intersect-overlap', ab: { l: 5, r: 15, t: 5, b: 25 }, expect: { kind: 'intersect' } },
    { name: 'intersect-embedded', ab: { l: 3, r: 7, t: 5, b: 15 }, expect: { kind: 'intersect' } },
    { name: 'h-gap-0-touch', ab: { l: 10, r: 20, t: 0, b: 20 }, expect: { kind: 'h-gap', gap: 0 } },
    { name: 'h-gap-1', ab: { l: 11, r: 21, t: 0, b: 20 }, expect: { kind: 'h-gap', gap: 1 } },
    { name: 'h-gap-5', ab: { l: 15, r: 25, t: 0, b: 20 }, expect: { kind: 'h-gap', gap: 5 } },
    { name: 'h-gap-7', ab: { l: 17, r: 27, t: 0, b: 20 }, expect: { kind: 'h-gap', gap: 7 } },
    { name: 'h-gap-8-pass', ab: { l: 18, r: 28, t: 0, b: 20 }, expect: null },
    { name: 'h-gap-12-pass', ab: { l: 22, r: 32, t: 0, b: 20 }, expect: null },
    { name: 'v-gap-0-touch', ab: { l: 0, r: 10, t: 20, b: 40 }, expect: { kind: 'v-gap', gap: 0 } },
    { name: 'v-gap-1', ab: { l: 0, r: 10, t: 21, b: 41 }, expect: { kind: 'v-gap', gap: 1 } },
    { name: 'v-gap-5', ab: { l: 0, r: 10, t: 25, b: 45 }, expect: { kind: 'v-gap', gap: 5 } },
    { name: 'v-gap-7', ab: { l: 0, r: 10, t: 27, b: 47 }, expect: { kind: 'v-gap', gap: 7 } },
    { name: 'v-gap-8-pass', ab: { l: 0, r: 10, t: 28, b: 48 }, expect: null },
    { name: 'v-gap-12-pass', ab: { l: 0, r: 10, t: 32, b: 52 }, expect: null },
    { name: 'diagonal-no-axes', ab: { l: 20, r: 30, t: 20, b: 40 }, expect: null },
    { name: 'diagonal-far', ab: { l: 100, r: 120, t: 100, b: 130 }, expect: null }
  ];
  const probes = [];
  let fail = 0;
  for (const c of cases) {
    const got = classifyGap(f, c.ab);
    const ok = c.expect === null ? got === null : !!(got && got.kind === c.expect.kind && (c.expect.gap === undefined || got.gap === c.expect.gap));
    if (!ok) fail++;
    probes.push({ name: c.name, expect: c.expect === null ? null : c.expect, got: got === null ? null : got, pass: ok });
  }
  return { pass: fail === 0, total: cases.length, failures: fail, probes };
}

module.exports = { classifyGap, runNegativeControls };
