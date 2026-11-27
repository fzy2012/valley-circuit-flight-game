// Deterministic value noise: an integer lattice hash (Math.imul based, so it
// gives the same numbers in every browser) with smooth bilinear interpolation,
// summed over octaves. The terrain, the tree scatter and the cloud field all
// sample this, which is what makes the valley identical on every run.

function latticeHash(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// One octave of value noise at world position (x, z); cell is the lattice size.
export function valueNoise(x, z, cell, seed) {
  const fx = x / cell;
  const fz = z / cell;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smooth(fx - ix);
  const tz = smooth(fz - iz);
  const a = latticeHash(ix, iz, seed);
  const b = latticeHash(ix + 1, iz, seed);
  const c = latticeHash(ix, iz + 1, seed);
  const d = latticeHash(ix + 1, iz + 1, seed);
  return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz) * 2 - 1;
}

// Fractal sum in roughly [-1, 1]: big shapes from the low octaves, detail on top.
export function fbm(x, z, cell, seed, octaves = 3) {
  let sum = 0;
  let amp = 0.55;
  let size = cell;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, z, size, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    size *= 0.5;
  }
  return sum / norm;
}

// A small seeded PRNG for one-off scatters (trees, clouds) that must not
// depend on sampling order.
export function mulberry(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
