/*
 * The back of the ticket: Daybreak's first light. The Earth's dark curve
 * low on the card, its rim lit, cool at the sides and warm where the sun
 * comes up over it, the way Daybreak's site and its icon draw the sunrise.
 * The sun is drawn in code, a soft disc with long faint rays, as the
 * Dock's is.
 *
 * The sun rises once when the back first shows, over Setup's 1.4 seconds
 * on its rise spring; a tap sinks it behind the Earth and brings it up
 * again. Everything here is drawn each frame by the ticket's own loop, at
 * the rise's level, with the tilt's slide: the Earth, nearest, slides
 * least, the sun, farthest, most.
 */

/** Setup's rise spring, as the site samples it (its RISE_SPRING). */
const SPRING = [
  0, 0.047, 0.156, 0.289, 0.426, 0.552, 0.662, 0.753, 0.825, 0.881, 0.923,
  0.953, 0.974, 0.988, 0.997, 1.002, 1.005, 1.006, 1.006, 1.006, 1.005, 1.004,
  1.003, 1.003, 1,
];
export const RISE_MS = 1400;
/** A tap's sinking, before the sun comes up again. */
export const SINK_MS = 420;

const spring = (u: number) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const i = u * (SPRING.length - 1);
  const k = Math.floor(i);
  return SPRING[k]! + (SPRING[k + 1]! - SPRING[k]!) * (i - k);
};

/** Where the horizon's top sits, as a share of the card's height. */
export const HORIZON = 0.74;

/**
 * The sun's rise: 0 below the Earth, 1 cresting it. `rise` starts it from
 * wherever it is, sinking first when it's up.
 */
export function sunrise() {
  let at: number | null = null;
  let from = 0;
  const level = (now: number) => {
    if (at === null) return 0;
    const ms = now - at;
    const sink = from > 0.02 ? SINK_MS * Math.min(1, from) : 0;
    if (ms < sink) {
      const u = ms / sink;
      return from * (1 - u * u * u);
    }
    return spring((ms - sink) / RISE_MS);
  };
  return {
    level,
    rise(now: number) {
      from = Math.max(0, Math.min(1, level(now)));
      at = now;
    },
    started: () => at !== null,
  };
}

/** A fixed scatter, so each frame draws the same rays and clouds. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const RAYS = Array.from({ length: 44 }, (_, i) => ({
  a: (i / 44) * Math.PI * 2 + (hash(i) - 0.5) * 0.12,
  long: 0.35 + hash(i + 50) ** 2 * 0.65,
  w: 0.5 + hash(i + 90),
  phase: hash(i + 130) * 7,
}));

/** Clouds on the lit side of the Earth, near the rim, where dawn catches them. */
const CLOUDS = Array.from({ length: 30 }, (_, i) => ({
  x: hash(i + 200) * 1.4 - 0.2,
  d: 0.012 + hash(i + 260) ** 1.6 * 0.12,
  w: 0.04 + hash(i + 320) * 0.12,
  a: 0.35 + hash(i + 380) * 0.65,
}));

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/**
 * Draws the dawn into a canvas that overhangs the card by `pad` on every
 * side (as the stars' does, for the tilt's slide). `level` is the rise's,
 * `t` seconds for the rays' slow turn and the clouds' drift, and `sx`, `sy`
 * the tilt's slide, about -1 to 1.
 */
export function drawDawn(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pad: number,
  level: number,
  t: number,
  sx: number,
  sy: number,
) {
  const cw = W - pad * 2;
  const ch = H - pad * 2;
  if (cw <= 0 || ch <= 0) return;
  const L = clamp(level, 0, 1.01);
  const up = clamp(level);
  ctx.clearRect(0, 0, W, H);

  // The Earth: a great circle whose top is the horizon.
  const R = cw * 1.75;
  const ex = sx * 3;
  const ey = sy * 2;
  const cx = pad + cw / 2 + ex;
  const top = pad + ch * HORIZON + ey;
  const cy = top + R;
  const sunX = pad + cw / 2 + sx * 8;
  const sunR = Math.max(10, cw * 0.042);
  // Below the Earth at 0, cresting it at 1: most of the disc up, its foot
  // still behind the rim.
  const sunY = top + sy * 6 + sunR * 2.6 + (-sunR * 0.5 - sunR * 2.6) * L;
  const glow = 0.5 + 0.5 * up;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // The air over the whole rim, lavender, thinning upward.
  const air = ctx.createRadialGradient(cx, cy, R - 2, cx, cy, R + ch * 0.3);
  air.addColorStop(0, `rgba(160,170,255,${0.5 * glow})`);
  air.addColorStop(0.07, `rgba(132,118,236,${0.26 * glow})`);
  air.addColorStop(0.32, `rgba(92,74,196,${0.1 * glow})`);
  air.addColorStop(1, "rgba(60,40,150,0)");
  ctx.fillStyle = air;
  ctx.fillRect(0, 0, W, H);

  // And warm over the sun, spreading along the horizon as it comes up.
  const spread = cw * (0.32 + 0.42 * up);
  ctx.save();
  ctx.translate(sunX, top);
  ctx.scale(1, 0.46);
  const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, spread);
  warm.addColorStop(0, `rgba(255,214,172,${0.85 * up})`);
  warm.addColorStop(0.22, `rgba(255,170,140,${0.4 * up})`);
  warm.addColorStop(0.55, `rgba(206,140,226,${0.16 * up})`);
  warm.addColorStop(1, "rgba(150,110,230,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(-spread, -spread, spread * 2, spread * 2);
  ctx.restore();

  // The sun: a halo, long faint rays turning slowly, and a soft disc.
  if (sunY < top + sunR * 1.4) {
    const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 8);
    halo.addColorStop(0, `rgba(255,240,222,${0.55 * up})`);
    halo.addColorStop(0.25, `rgba(255,206,170,${0.2 * up})`);
    halo.addColorStop(1, "rgba(255,180,150,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - sunR * 8, sunY - sunR * 8, sunR * 16, sunR * 16);

    for (const ray of RAYS) {
      const a = ray.a + t * 0.025;
      const len =
        sunR * (2.2 + 7.5 * ray.long) * (0.85 + 0.15 * Math.sin(t * 0.8 + ray.phase)) * (0.4 + 0.6 * up);
      const half = sunR * 0.09 * ray.w;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const g = ctx.createLinearGradient(sunX, sunY, sunX + dx * len, sunY + dy * len);
      g.addColorStop(0, `rgba(255,244,230,${0.3 * up})`);
      g.addColorStop(1, "rgba(255,220,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sunX - dy * half, sunY + dx * half);
      ctx.lineTo(sunX + dx * len, sunY + dy * len);
      ctx.lineTo(sunX + dy * half, sunY - dx * half);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // The disc itself, drawn plainly so the Earth can cover it.
  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 1.35);
  disc.addColorStop(0, "rgba(255,255,255,1)");
  disc.addColorStop(0.55, "rgba(255,251,244,1)");
  disc.addColorStop(0.78, "rgba(255,226,196,0.65)");
  disc.addColorStop(1, "rgba(255,206,170,0)");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // The Earth's night side, faintly lit along its top by the air.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  const body = ctx.createLinearGradient(0, top, 0, top + ch * 0.32);
  body.addColorStop(0, "#151a40");
  body.addColorStop(0.22, "#0a0d26");
  body.addColorStop(1, "#040510");
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  // Dawn on the ground under the sun.
  ctx.globalCompositeOperation = "lighter";
  ctx.save();
  ctx.translate(sunX, top);
  ctx.scale(1, 0.32);
  const lit = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 0.75);
  lit.addColorStop(0, `rgba(255,186,150,${0.24 * up})`);
  lit.addColorStop(0.4, `rgba(150,130,240,${0.05 * up + 0.02})`);
  lit.addColorStop(1, "rgba(80,80,200,0)");
  ctx.fillStyle = lit;
  ctx.fillRect(-cw * 0.75, 0, cw * 1.5, cw * 0.75);
  ctx.restore();
  // Clouds near the rim catch it, flattened by the curve, drifting.
  for (const c of CLOUDS) {
    const x = pad + ((((c.x + t * 0.004) % 1.4) + 1.4) % 1.4 - 0.2) * cw + ex;
    const y = top + c.d * ch + ((x - cx) ** 2) / (2 * R);
    const near = Math.exp(-(((x - sunX) / (cw * 0.42)) ** 2));
    const a = c.a * (0.05 + 0.2 * near * up) * (1 - c.d * 5);
    if (a <= 0.005) continue;
    const w = c.w * cw;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.16 + c.d * 1.6);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    g.addColorStop(0, `rgba(255,${Math.round(205 + 40 * (1 - near))},${Math.round(185 + 60 * (1 - near))},${a})`);
    g.addColorStop(1, "rgba(255,230,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();
  }
  ctx.restore();

  // The rim: a thin bright line, cool at the sides, white over the sun,
  // with a bloom round it.
  const rim = ctx.createLinearGradient(pad, 0, pad + cw, 0);
  const sunAt = clamp((sunX - pad) / cw, 0.05, 0.95);
  rim.addColorStop(0, "rgba(140,156,255,0.75)");
  rim.addColorStop(clamp(sunAt - 0.24), "rgba(206,184,255,0.9)");
  rim.addColorStop(sunAt, "rgba(255,250,244,1)");
  rim.addColorStop(clamp(sunAt + 0.24), "rgba(206,184,255,0.9)");
  rim.addColorStop(1, "rgba(140,156,255,0.75)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rim;
  for (const [width, alpha] of [
    [16, 0.07],
    [6, 0.22],
    [1.5, 0.95],
  ] as const) {
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // Where the sun meets the rim, a bright bead, and a thin flare along the
  // horizon, strongest as the sun crosses it.
  const crest = clamp(1 - Math.abs(sunY - top) / (sunR * 2.6)) * clamp(up * 1.4);
  if (crest > 0.01) {
    ctx.globalAlpha = 1;
    const bead = ctx.createRadialGradient(sunX, top, 0, sunX, top, sunR * 2.4);
    bead.addColorStop(0, `rgba(255,255,255,${0.9 * crest})`);
    bead.addColorStop(0.3, `rgba(255,236,214,${0.35 * crest})`);
    bead.addColorStop(1, "rgba(255,220,200,0)");
    ctx.fillStyle = bead;
    ctx.fillRect(sunX - sunR * 2.4, top - sunR * 2.4, sunR * 4.8, sunR * 4.8);
    const flare = ctx.createLinearGradient(sunX - cw * 0.36, 0, sunX + cw * 0.36, 0);
    flare.addColorStop(0, "rgba(255,240,230,0)");
    flare.addColorStop(0.5, `rgba(255,244,236,${0.55 * crest})`);
    flare.addColorStop(1, "rgba(255,240,230,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(sunX - cw * 0.36, top - 0.9, cw * 0.72, 1.8);
  }
  ctx.restore();
}
