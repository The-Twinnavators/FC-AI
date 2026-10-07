/**
 * The Network as a constellation: projects glow at the core and each group (Structure, Code, Knowledge, Intelligence)
 * is its own cluster on an orbit around them. Drawn on a 2D canvas with simple perspective. Links inside a cluster are
 * short and straight; links between clusters arc through the core. It turns slowly when idle, coasts after a drag,
 * nodes bob gently, signals glide along links and bounce the node they reach, and a selected node turns to face you.
 */
import { useEffect, useRef } from "react";

export interface CNode {
  id: string;
  type: string;
  label: string;
  group: string;
  bx: number;
  by: number;
  bz: number;
  phase: number;
  hub?: boolean;
}
export interface CEdge {
  from: string;
  to: string;
}
export interface CCluster {
  label: string;
  x: number;
  y: number;
  z: number;
  r: number;
  count: number;
  color: string;
}

interface Props {
  nodes: CNode[];
  edges: CEdge[];
  clusters: CCluster[];
  orbit: number;
  colors: Record<string, string>;
  selectedId?: string | null;
  labels?: boolean;
  onSelect?: (id: string | null) => void;
  /** A small, look-only copy (the dashboard card): no dragging, zooming or selecting; the card handles the click. */
  preview?: boolean;
  /** An overlay on the canvas (the side panel) the graph is framed beside, not behind. */
  avoid?: React.RefObject<HTMLElement | null>;
  /** Open with the graph bursting out from the core into its clusters. */
  explode?: boolean;
}

/** Ease out with a small overshoot, so the burst lands and settles. */
const easeOutBack = (u: number) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
};
const EXPLODE_S = 0.9;
/** A few orbs overshoot toward the viewer, streak past the camera, then fall back into place. */
const FLY_S = 1.7;
const FLYER_SHARE = 0.035;

const CAM_D = 4.2;
const SPRING_K = 80;
const DAMP = 7;
/** Knock-back spring: looser than the drag spring so a hit overshoots once or twice before settling. */
const KNOCK_K = 120;
const KNOCK_DAMP = 4.2;
const MUTED: [number, number, number] = [62, 68, 88];
const FONT = `"Manrope Variable", Manrope, "Segoe UI", sans-serif`;

const rgbOf = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [160, 170, 190];
};
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function ConstellationGraph(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;
  const faceRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    if (props.selectedId) faceRef.current(props.selectedId);
  }, [props.selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = window.devicePixelRatio || 1;
    let W = 0;
    let H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      W = r.width;
      H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Seen slightly from above, like an orrery.
    let rotY = 0.6;
    let rotX = -0.62;
    let rotYVel = 0;
    let rotXVel = 0;
    let target: { y: number; x: number; z: number } | null = null;
    // The dashboard preview: a closer view, with smaller orbs and much less glow.
    const pv = !!live.current.preview;
    // Smaller, calmer orbs on the Network page too (they grow with zoom, and the auto-fit zooms in).
    const ORB = pv ? 0.32 : 0.55;
    const GLOW = pv ? 0.3 : 0.35;
    let zoomTarget = pv ? 1.6 : 1;
    let panX = 0;
    let panY = 0;
    // Framing: until you move the view yourself, the whole graph is kept in the open space beside the side panel.
    let homeZoom = zoomTarget;
    let homePan = { x: 0, y: 0 };
    let userMoved = false;
    let lastFit = -1e9;
    const fitView = () => {
      if (!projected.length) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of projected) {
        x0 = Math.min(x0, p.sx); x1 = Math.max(x1, p.sx);
        y0 = Math.min(y0, p.sy); y1 = Math.max(y1, p.sy);
      }
      [x0, x1, y0, y1] = [x0 / dpr, x1 / dpr, y0 / dpr, y1 / dpr];
      const cr = canvas.getBoundingClientRect();
      const side = live.current.avoid?.current?.getBoundingClientRect();
      const left = (side && side.width ? Math.max(0, side.right - cr.left) : 0) + 32;
      const free = { l: left, r: W - 40, t: 48, b: H - 48 };
      const bw = Math.max(1, x1 - x0);
      const bh = Math.max(1, y1 - y0);
      const f = Math.max(0.5, Math.min(2.2, Math.min((free.r - free.l) / bw, (free.b - free.t) / bh)));
      // Zooming scales everything about the view's centre (canvas centre + pan).
      const ox = W / 2 + panX;
      const oy = H / 2 + panY;
      const cx = ox + ((x0 + x1) / 2 - ox) * f;
      const cy = oy + ((y0 + y1) / 2 - oy) * f;
      homeZoom = Math.max(0.5, Math.min(3.2, zoom * f));
      homePan = { x: panX + (free.l + free.r) / 2 - cx, y: panY + (free.t + free.b) / 2 - cy };
      zoomTarget = homeZoom;
    };
    let zoom = zoomTarget;
    let dragging = false;
    let didDrag = false;
    let dragMode: "rotate" | "pan" = "rotate";
    let dragStart = { x: 0, y: 0, rotX: 0, rotY: 0, panX: 0, panY: 0 };
    let hoverId: string | null = null;
    let lastInteract = performance.now();
    let nodeDragId: string | null = null;
    let nodeDragStart = { mx: 0, my: 0, ox: 0, oy: 0 };
    const offsets = new Map<string, { ox: number; oy: number; vx: number; vy: number }>();
    const bounce = new Map<string, { amp: number; vel: number }>();
    const sigs: Array<{ from: string; to: string; p: number; speed: number; hops: number; rgb: [number, number, number]; hit?: boolean }> = [];
    let lastSig = 0;
    const plucks: Array<{ from: string; to: string; at: number; amp: number; rgb: [number, number, number] }> = [];

    faceRef.current = (id) => {
      const n = live.current.nodes.find((x) => x.id === id);
      if (!n) return;
      let ty = Math.atan2(n.bx, -n.bz);
      while (ty - rotY > Math.PI) ty -= Math.PI * 2;
      while (ty - rotY < -Math.PI) ty += Math.PI * 2;
      target = { y: ty, x: Math.max(-1.0, Math.min(0.2, Math.atan2(-n.by, Math.hypot(n.bx, n.bz) || 0.001) - 0.35)), z: 1.35 };
      lastInteract = performance.now();
    };

    const scale = () => Math.min(W * 0.55, H) * 0.3 * zoom * dpr;
    const project = (x: number, y: number, z: number) => {
      const persp = CAM_D / (CAM_D + z);
      const s = scale();
      return { sx: (W / 2) * dpr + x * s * persp + panX * dpr, sy: (H / 2) * dpr - y * s * persp + panY * dpr, persp };
    };
    const rotate = (bx: number, by: number, bz: number) => {
      const cy = Math.cos(rotY);
      const syv = Math.sin(rotY);
      const x1 = bx * cy + bz * syv;
      const z1 = -bx * syv + bz * cy;
      const cx = Math.cos(rotX);
      const sxv = Math.sin(rotX);
      return { x: x1, y: by * cx - z1 * sxv, z: by * sxv + z1 * cx };
    };

    type P = CNode & { sx: number; sy: number; depth: number; r: number; rx: number; ry: number; rz: number };
    let projected: P[] = [];
    const hitTest = (mx: number, my: number) => {
      let best: P | null = null;
      let bd = 1e9;
      for (let i = projected.length - 1; i >= 0; i--) {
        const p = projected[i];
        const d = Math.hypot(mx * dpr - p.sx, my * dpr - p.sy);
        if (d < p.r + 5 * dpr && d < bd) {
          best = p;
          bd = d;
        }
      }
      return best;
    };
    /** Control point for a link: straight inside a cluster, an arc pulled toward the core between clusters. */
    const control = (a: P, b: P) => {
      if (a.group === b.group) return null;
      const k = 0.28;
      const c = project(((a.rx + b.rx) / 2) * k, ((a.ry + b.ry) / 2) * k, ((a.rz + b.rz) / 2) * k);
      return c;
    };
    const along = (a: P, b: P, c: { sx: number; sy: number } | null, u: number) => {
      if (!c) return { x: a.sx + (b.sx - a.sx) * u, y: a.sy + (b.sy - a.sy) * u };
      const v = 1 - u;
      return { x: v * v * a.sx + 2 * v * u * c.sx + u * u * b.sx, y: v * v * a.sy + 2 * v * u * c.sy + u * u * b.sy };
    };

    // The space around the graph, in three layers so turning the graph shows depth: far stars on a sky dome (they
    // turn with the view but never get closer), nearer dust around the clusters (it shifts past the far stars and
    // grows with zoom), and two soft nebula glows anchored at points in the scene.
    // Knowledge arriving from outside: now and then a star is caught, pulled into the Knowledge cluster and slams into
    // a source node (no node is added). Its spot in the sky fades back in later.
    const caught = new Map<number, { back: number }>();
    let starPos: Array<{ i: number; sx: number; sy: number; size: number; a: number }> = [];
    const comets: Array<{ x0: number; y0: number; size: number; a0: number; to: string; t0: number; dur: number; trail: Array<[number, number]> }> = [];
    const impacts: Array<{ to: string; at: number; rgb: [number, number, number] }> = [];
    let lastComet = performance.now();
    let nextComet = 1800;

    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const onSphere = () => {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return { x: s * Math.cos(a), y: u, z: s * Math.sin(a) };
    };
    const sky = Array.from({ length: 1400 }, () => ({ ...onSphere(), size: rand() < 0.06 ? 1.5 : 0.5 + rand() * 0.7, tw: rand() * Math.PI * 2, warm: rand() < 0.18 }));
    const dust = Array.from({ length: 320 }, () => {
      const d = onSphere();
      const r = 2.1 + rand() * 2.6;
      return { x: d.x * r, y: d.y * r * 0.7, z: d.z * r, size: 0.4 + rand() * 0.9, tw: rand() * Math.PI * 2 };
    });
    const NEBULAE: Array<{ x: number; y: number; z: number; r: number; rgb: [number, number, number]; a: number }> = [
      { x: 0, y: 0, z: 0, r: 2.4, rgb: [96, 78, 200], a: 0.22 },
      { x: 2.6, y: -0.8, z: 1.8, r: 1.9, rgb: [40, 130, 150], a: 0.1 },
      { x: -2.4, y: 1.0, z: -1.6, r: 1.6, rgb: [192, 132, 252], a: 0.08 },
    ];
    const drawSpace = (t: number) => {
      const s = scale();
      for (const n of NEBULAE) {
        const r3 = rotate(n.x, n.y, n.z);
        if (CAM_D + r3.z < 0.8) continue;
        const p = project(r3.x, r3.y, r3.z);
        const rad = n.r * s * p.persp;
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad);
        g.addColorStop(0, rgba(n.rgb, n.a));
        g.addColorStop(0.5, rgba(n.rgb, n.a * 0.35));
        g.addColorStop(1, rgba(n.rgb, 0));
        ctx.fillStyle = g;
        ctx.fillRect(p.sx - rad, p.sy - rad, rad * 2, rad * 2);
      }
      const f = Math.max(W, H) * 0.7 * dpr;
      const cx = (W / 2 + panX * 0.12) * dpr;
      const cy = (H / 2 + panY * 0.12) * dpr;
      starPos = [];
      for (let i = 0; i < sky.length; i++) {
        const st = sky[i];
        const r3 = rotate(st.x, st.y, st.z);
        if (r3.z < 0.15) continue;
        const sx = cx + (r3.x / r3.z) * f;
        const sy = cy - (r3.y / r3.z) * f;
        if (sx < 0 || sy < 0 || sx > W * dpr || sy > H * dpr) continue;
        let a = (reduce ? 0.55 : 0.4 + 0.3 * Math.sin(t * 1.3 + st.tw)) * Math.min(1, r3.z * 1.6);
        // A caught star is gone until its spot fades back in.
        const c = caught.get(i);
        if (c) {
          if (t < c.back) continue;
          const k = Math.min(1, (t - c.back) / 1.5);
          if (k >= 1) caught.delete(i);
          a *= k;
        } else if (st.size > 0.85) starPos.push({ i, sx, sy, size: st.size, a });
        ctx.fillStyle = st.warm ? `rgba(240,200,255,${a})` : `rgba(200,215,255,${a})`;
        const r = st.size * dpr;
        ctx.fillRect(sx - r / 2, sy - r / 2, r, r);
      }
      for (const d of dust) {
        const r3 = rotate(d.x, d.y, d.z);
        if (CAM_D + r3.z < 0.6) continue;
        const p = project(r3.x, r3.y, r3.z);
        const near = Math.min(1, Math.max(0, (CAM_D - r3.z) / (CAM_D * 2)));
        const a = (reduce ? 0.5 : 0.35 + 0.2 * Math.sin(t * 0.8 + d.tw)) * (0.35 + near * 0.65);
        const r = d.size * dpr * p.persp * 1.6 * Math.sqrt(zoom);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,190,255,${a})`;
        ctx.fill();
      }
    };

    let raf = 0;
    let lastT = performance.now();
    // The burst starts the first time the canvas is on screen, so it isn't over before anyone sees it.
    let born = live.current.explode ? Infinity : performance.now();
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        born = performance.now();
        seen.disconnect();
      }
    }, { threshold: 0.35 });
    if (live.current.explode) seen.observe(canvas);
    // How far out from the core something is during the opening burst (1 once it's over). Each node starts a little
    // after the last, by its phase, so the burst reads as a spray rather than one ring.
    const spread = (now: number, delay = 0) => {
      if (reduce || !live.current.explode) return 1;
      const u = Math.max(0, Math.min(1, ((now - born) / 1000 - delay) / EXPLODE_S));
      return u <= 0 ? 0.001 : easeOutBack(u);
    };
    // ── Demo cursor (preview only): once the burst has settled, a cursor shows how to explore the graph, on a loop:
    // drag down and up to tilt, drag sideways to turn, scroll to zoom in, move to an orb and click it (it lights up
    // with its name), then zoom back out. All scripted; nothing on the page is clicked.
    let demoSel: string | null = null;
    let demoTarget: string | null = null;
    let demoClickAt = -1;
    let demoCycle = -1;
    const cur = { x: 0, y: 0, a: 0, down: false, wheel: false };
    let prevCur = { x: 0, y: 0 };
    const DEMO_CYCLE = 13;
    const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
    const demoStep = (now: number) => {
      const settleAt = born + (EXPLODE_S + FLY_S + 0.6) * 1000;
      if (reduce || !Number.isFinite(born) || now < settleAt) return;
      const elapsed = (now - settleAt) / 1000;
      const cycle = Math.floor(elapsed / DEMO_CYCLE);
      const c = elapsed - cycle * DEMO_CYCLE;
      if (cycle !== demoCycle) {
        demoCycle = cycle;
        demoTarget = null;
        demoSel = null;
        hoverId = null;
      }
      lastInteract = now;
      const A = { x: W * 0.6, y: H * 0.5 };
      const B = { x: W * 0.6 + 60, y: H * 0.5 };
      let pos = A;
      cur.down = false;
      cur.wheel = false;
      cur.a = c < 0.6 ? ease(c / 0.6) : c > 11.8 ? 1 - ease((c - 11.8) / 0.8) : 1;
      const targetPos = () => {
        const p = demoTarget ? projected.find((n) => n.id === demoTarget) : undefined;
        return p ? { x: p.sx / dpr, y: p.sy / dpr } : A;
      };
      if (c < 0.6) pos = A;
      else if (c < 2.4) {
        // Drag down, then up: the graph tilts.
        cur.down = true;
        pos = { x: A.x, y: A.y + Math.sin(((c - 0.6) / 1.8) * Math.PI * 2) * 55 };
      } else if (c < 2.8) pos = { x: lerp(A.x, B.x, ease((c - 2.4) / 0.4)), y: A.y };
      else if (c < 4.8) {
        // Drag sideways: the graph turns.
        cur.down = true;
        pos = { x: lerp(B.x, A.x - 90, ease((c - 2.8) / 2)), y: A.y };
      } else if (c < 5.2) pos = { x: lerp(A.x - 90, A.x, ease((c - 4.8) / 0.4)), y: A.y };
      else if (c < 6.6) {
        // Scroll: zoom in.
        cur.wheel = true;
        pos = A;
        zoomTarget = lerp(1.6, 2.6, ease((c - 5.2) / 1.4));
      } else if (c < 8) {
        // Pick an orb near the middle, at the front, and move to it.
        if (!demoTarget) {
          const inView = projected.filter((p) => p.sx / dpr > W * 0.22 && p.sx / dpr < W * 0.78 && p.sy / dpr > H * 0.25 && p.sy / dpr < H * 0.72);
          const pick = inView.filter((p) => p.hub).sort((a, b) => a.depth - b.depth)[0] ?? [...inView].sort((a, b) => a.depth - b.depth)[0];
          demoTarget = pick?.id ?? null;
        }
        const t = targetPos();
        const u = ease((c - 6.6) / 1.4);
        pos = { x: lerp(A.x, t.x, u), y: lerp(A.y, t.y, u) };
      } else if (c < 10.4) {
        // Click: the orb lights up with its name.
        if (demoSel !== demoTarget) {
          demoSel = demoTarget;
          hoverId = demoTarget;
          demoClickAt = now;
        }
        pos = targetPos();
      } else {
        // Let go and zoom back out.
        demoSel = null;
        hoverId = null;
        zoomTarget = 1.6;
        const from = targetPos();
        const u = ease((c - 10.4) / 1.4);
        pos = { x: lerp(from.x, A.x, u), y: lerp(from.y, A.y, u) };
      }
      // A drag moves the graph the way a real one would.
      if (cur.down && cur.a > 0) {
        rotY += (pos.x - prevCur.x) * 0.006;
        rotX = Math.max(-1.15, Math.min(0.25, rotX - (pos.y - prevCur.y) * 0.004));
      }
      prevCur = pos;
      cur.x = pos.x;
      cur.y = pos.y;
    };
    const drawCursor = (now: number) => {
      if (cur.a <= 0.01) return;
      const x = cur.x * dpr;
      const y = cur.y * dpr;
      // Click ripple on the orb.
      const rk = (now - demoClickAt) / 600;
      if (demoClickAt > 0 && rk >= 0 && rk < 1) {
        ctx.strokeStyle = "rgba(255,255,255," + (0.7 * (1 - rk)).toFixed(3) + ")";
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, (6 + rk * 22) * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Pressed: a soft ring at the tip.
      if (cur.down) {
        ctx.fillStyle = "rgba(255,255,255," + (0.16 * cur.a).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(x, y, 11 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Scrolling: two chevrons pulsing above the cursor.
      if (cur.wheel) {
        const k = (now / 400) % 1;
        ctx.strokeStyle = "rgba(255,255,255," + (0.75 * cur.a).toFixed(3) + ")";
        ctx.lineWidth = 1.6 * dpr;
        for (let i = 0; i < 2; i++) {
          const cy = y - (8 + i * 6 + k * 4) * dpr;
          ctx.beginPath();
          ctx.moveTo(x + 14 * dpr, cy + 3 * dpr);
          ctx.lineTo(x + 18 * dpr, cy - 1 * dpr);
          ctx.lineTo(x + 22 * dpr, cy + 3 * dpr);
          ctx.stroke();
        }
      }
      // The arrow.
      const pts: Array<[number, number]> = [[0, 0], [0, 16], [4.5, 12], [7.5, 18.5], [10, 17.3], [7, 11], [12.5, 11]];
      const sc = (cur.down ? 0.92 : 1) * dpr;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * sc, y + py * sc) : ctx.moveTo(x + px * sc, y + py * sc)));
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255," + cur.a.toFixed(3) + ")";
      ctx.strokeStyle = "rgba(10,12,22," + (0.9 * cur.a).toFixed(3) + ")";
      ctx.lineWidth = 1.2 * dpr;
      ctx.lineJoin = "round";
      ctx.fill();
      ctx.stroke();
    };
    const flyAmount = (now: number, phase: number) => {
      if (reduce || !live.current.explode || phase / 6.28 > FLYER_SHARE) return 0;
      const u = ((now - born) / 1000 - 0.05) / FLY_S;
      return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 1.6);
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const t = now / 1000;
      const { nodes, edges, clusters, orbit, colors, labels } = live.current;
      if (pv) demoStep(now);
      const selectedId = live.current.selectedId ?? demoSel;

      if (target) {
        const k = Math.min(1, dt * 3.5);
        rotY += (target.y - rotY) * k;
        rotX += (target.x - rotX) * k;
        zoom += (target.z - zoom) * k;
        if (Math.abs(target.y - rotY) < 0.002 && Math.abs(target.x - rotX) < 0.002) target = null;
      } else {
        if (!reduce && !dragging && now - lastInteract > 2500) rotY += dt * 0.05;
        if (!selectedId) zoom += (zoomTarget - zoom) * Math.min(1, dt * 2);
      }
      rotY += rotYVel * dt;
      rotX = Math.max(-1.15, Math.min(0.25, rotX + rotXVel * dt));
      rotYVel *= Math.exp(-3.5 * dt);
      rotXVel *= Math.exp(-3.5 * dt);

      if (!reduce && edges.length && sigs.length < 16 && now - lastSig > 260) {
        const e = edges[Math.floor(Math.random() * edges.length)];
        const fromNode = nodes.find((n) => n.id === e.from);
        if (fromNode) sigs.push({ from: e.from, to: e.to, p: 0, speed: 1.1 + Math.random() * 0.6, hops: 3 + Math.floor(Math.random() * 3), rgb: rgbOf(colors[fromNode.type] ?? "#a0aac0") });
        lastSig = now;
      }
      for (const [id, o] of offsets) {
        if (id === nodeDragId) continue;
        o.vx = (o.vx - KNOCK_K * o.ox * dt) * Math.exp(-KNOCK_DAMP * dt);
        o.vy = (o.vy - KNOCK_K * o.oy * dt) * Math.exp(-KNOCK_DAMP * dt);
        o.ox += o.vx * dt;
        o.oy += o.vy * dt;
        if (Math.abs(o.ox) + Math.abs(o.oy) + Math.abs(o.vx) + Math.abs(o.vy) < 0.2) offsets.delete(id);
      }

      // Nodes with no links are drawn as small white orbs.
      const linked = new Set<string>();
      for (const e of edges) {
        linked.add(e.from);
        linked.add(e.to);
      }
      const near = new Set<string>();
      if (selectedId) {
        near.add(selectedId);
        for (const e of edges) {
          if (e.from === selectedId) near.add(e.to);
          if (e.to === selectedId) near.add(e.from);
        }
      }

      projected = nodes
        .map((n) => {
          const wob = reduce ? 0 : Math.sin(t * 0.6 + n.phase) * 0.012;
          const ex = spread(now, (n.phase / 6.28) * 0.15);
          const r3 = rotate(n.bx * ex, (n.by + wob) * ex, n.bz * ex);
          // Fly-past: a small share of orbs swing out toward the camera (growing as they near it) and back.
          const fly = flyAmount(now, n.phase);
          if (fly > 0) {
            r3.z = Math.max(-CAM_D * 0.86, r3.z - fly * 3.6);
            r3.x *= 1 + fly * 1.2;
            r3.y *= 1 + fly * 1.2;
          }
          const p = project(r3.x, r3.y, r3.z);
          const b = bounce.get(n.id);
          if (b) {
            b.vel = (b.vel - SPRING_K * b.amp * dt) * Math.exp(-DAMP * dt);
            b.amp += b.vel * dt;
            if (Math.abs(b.amp) + Math.abs(b.vel) < 0.002) bounce.delete(n.id);
          }
          const base = (n.hub ? 6 : linked.has(n.id) ? 3.2 : 2) * ORB * dpr * p.persp * Math.sqrt(zoom);
          const off = offsets.get(n.id);
          return { ...n, sx: p.sx + (off ? off.ox * dpr : 0), sy: p.sy + (off ? off.oy * dpr : 0), depth: r3.z, rx: r3.x, ry: r3.y, rz: r3.z, r: base * (1 + (b?.amp ?? 0) * 0.5) };
        })
        .sort((a, b) => b.depth - a.depth);
      const byId = new Map(projected.map((p) => [p.id, p]));
      // Re-frame now and then (the graph turns, so its outline changes) until you take over the view.
      if (!pv && !userMoved && !selectedId && projected.length && now - lastFit > 1500) {
        fitView();
        lastFit = now;
      }
      if (!pv && !userMoved && !dragging) {
        const k = Math.min(1, dt * 2.5);
        panX += (homePan.x - panX) * k;
        panY += (homePan.y - panY) * k;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawSpace(t);

      // The orbit the clusters ride on.
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const r3 = rotate(Math.cos(a) * orbit * spread(now), 0, Math.sin(a) * orbit * spread(now));
        const p = project(r3.x, r3.y, r3.z);
        if (i) ctx.lineTo(p.sx, p.sy);
        else ctx.moveTo(p.sx, p.sy);
      }
      ctx.strokeStyle = "rgba(167,139,250,0.28)";
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([2 * dpr, 6 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Each cluster's soft field.
      const clusterProj = clusters.map((c) => {
        const r3 = rotate(c.x * spread(now), c.y * spread(now), c.z * spread(now));
        const p = project(r3.x, r3.y, r3.z);
        return { c, p, depth: r3.z, rad: c.r * scale() * p.persp * 1.35 };
      });
      for (const { c, p, rad } of clusterProj) {
        const rgb = rgbOf(c.color);
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad);
        g.addColorStop(0, rgba(rgb, 0.1 * GLOW));
        g.addColorStop(0.7, rgba(rgb, 0.035 * GLOW));
        g.addColorStop(1, rgba(rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      // Core glow behind the projects.
      {
        const p = project(0, 0, 0);
        const rad = scale() * 0.32;
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad);
        g.addColorStop(0, `rgba(240,171,252,${0.16 * GLOW})`);
        g.addColorStop(1, "rgba(240,171,252,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Links: one faint batch; the selection's links drawn bright on top.
      ctx.beginPath();
      for (const e of edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        const c = control(a, b);
        ctx.moveTo(a.sx, a.sy);
        if (c) ctx.quadraticCurveTo(c.sx, c.sy, b.sx, b.sy);
        else ctx.lineTo(b.sx, b.sy);
      }
      // Hairline and faint: thousands overlap, so each one stays barely there.
      ctx.strokeStyle = `rgba(160,170,210,${(selectedId ? 0.018 : 0.035) * (pv ? 0.45 : 1)})`;
      ctx.lineWidth = 0.5 * dpr;
      ctx.stroke();
      if (selectedId) {
        const s = byId.get(selectedId);
        const rgb = rgbOf(colors[s?.type ?? ""] ?? "#ffffff");
        ctx.beginPath();
        for (const e of edges) {
          if (e.from !== selectedId && e.to !== selectedId) continue;
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) continue;
          const c = control(a, b);
          ctx.moveTo(a.sx, a.sy);
          if (c) ctx.quadraticCurveTo(c.sx, c.sy, b.sx, b.sy);
          else ctx.lineTo(b.sx, b.sy);
        }
        ctx.strokeStyle = rgba(rgb, 0.5);
        ctx.lineWidth = 1.3 * dpr;
        ctx.stroke();
      }

      // A link drawn as an elastic tether: `bend(u)` displaces it sideways (in px) along its length.
      const tether = (a: P, b: P, c: { sx: number; sy: number } | null, bend: (u: number) => number) => {
        const nx = -(b.sy - a.sy);
        const ny = b.sx - a.sx;
        const len = Math.hypot(nx, ny) || 1;
        ctx.beginPath();
        for (let k = 0; k <= 26; k++) {
          const u = k / 26;
          const q = along(a, b, c, u);
          const d = bend(u) * dpr;
          const x = q.x + (nx / len) * d;
          const y = q.y + (ny / len) * d;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
      };

      // Plucked tethers: after a signal lands, its link vibrates like a string and settles.
      for (let i = plucks.length - 1; i >= 0; i--) {
        const pl = plucks[i];
        const a = byId.get(pl.from);
        const b = byId.get(pl.to);
        const age = t - pl.at;
        if (!a || !b || age > 1.1) {
          plucks.splice(i, 1);
          continue;
        }
        const env = Math.exp(-age * 4.5);
        const swing = Math.sin(age * 26) * env * pl.amp;
        tether(a, b, control(a, b), (u) => Math.sin(Math.PI * u) * swing + Math.sin(Math.PI * 2 * u) * swing * 0.35);
        ctx.strokeStyle = rgba(pl.rgb, 0.45 * env);
        ctx.lineWidth = 1.2 * dpr;
        ctx.stroke();
      }

      // Signals: a glowing orb races along the link, tugging the tether into a soft bulge as it goes; on arrival it
      // shoves the node in its direction of travel (spring-back with overshoot) and plucks the tether.
      for (let i = sigs.length - 1; i >= 0; i--) {
        const s = sigs[i];
        const a = byId.get(s.from);
        const b = byId.get(s.to);
        if (!a || !b) {
          sigs.splice(i, 1);
          continue;
        }
        s.p += dt * s.speed;
        const c = control(a, b);
        if (s.p >= 1) {
          // Momentum: direction of travel at the end of the link.
          const from = c ? { x: c.sx, y: c.sy } : { x: a.sx, y: a.sy };
          const dx = b.sx - from.x;
          const dy = b.sy - from.y;
          const len = Math.hypot(dx, dy) || 1;
          const push = 160 + s.speed * 60;
          const o = offsets.get(s.to) ?? { ox: 0, oy: 0, vx: 0, vy: 0 };
          o.vx += (dx / len) * push;
          o.vy += (dy / len) * push;
          offsets.set(s.to, o);
          const bt = bounce.get(s.to) ?? { amp: 0, vel: 0 };
          bt.vel += 6;
          bounce.set(s.to, bt);
          plucks.push({ from: s.from, to: s.to, at: t, amp: 5 + Math.random() * 3, rgb: s.rgb });
          sigs.splice(i, 1);
          continue;
        }
        // Hops: the orb arcs off the tether and lands again, each bounce a little lower. The tether dips where it lands.
        const phase = (s.p * s.hops) % 1;
        const hop = Math.sin(Math.PI * phase) * 9 * (1 - s.p * 0.45);
        const dip = -Math.max(0, 1 - phase * 5, (phase - 0.8) * 5) * 3.5;
        const pull = hop;
        tether(a, b, c, (u) => dip * Math.exp(-((u - s.p) ** 2) / 0.01));
        ctx.strokeStyle = rgba(s.rgb, 0.18 + Math.sin(Math.PI * s.p) * 0.3);
        ctx.lineWidth = 1.1 * dpr;
        ctx.stroke();
        const q = along(a, b, c, s.p);
        const nx = -(b.sy - a.sy);
        const ny = b.sx - a.sx;
        const nl = Math.hypot(nx, ny) || 1;
        const o = { x: q.x + (nx / nl) * pull * dpr, y: q.y + (ny / nl) * pull * dpr };
        const og = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 8 * dpr);
        og.addColorStop(0, rgba(s.rgb, 0.55));
        og.addColorStop(1, rgba(s.rgb, 0));
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 8 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba([255, 255, 255], 0.9);
        ctx.beginPath();
        ctx.arc(o.x, o.y, 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes, far to near.
      for (const p of projected) {
        const dim = !!selectedId && !near.has(p.id);
        const lone = !linked.has(p.id);
        const rgb: [number, number, number] = dim ? MUTED : lone ? [236, 240, 255] : rgbOf(colors[p.type] ?? "#a0aac0");
        const front = Math.max(0, Math.min(1, (1.6 - p.depth) / 3.2));
        const alpha = 0.35 + front * 0.65;
        const halo = p.r * (p.hub ? 4.2 : lone ? 4.5 : 3.2) * (pv ? 0.6 : 0.7);
        const hg = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, halo);
        hg.addColorStop(0, rgba(rgb, (dim ? 0.06 : 0.3) * alpha * GLOW));
        hg.addColorStop(1, rgba(rgb, 0));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, halo, 0, Math.PI * 2);
        ctx.fill();
        const core = ctx.createRadialGradient(p.sx - p.r * 0.3, p.sy - p.r * 0.35, 0, p.sx, p.sy, p.r);
        core.addColorStop(0, `rgba(255,255,255,${dim ? 0.08 : 0.6 * alpha})`);
        core.addColorStop(0.45, rgba(rgb, alpha));
        core.addColorStop(1, rgba(rgb, 0.7 * alpha));
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.id === selectedId) {
          ctx.lineWidth = 2 * dpr;
          ctx.strokeStyle = rgba(rgb, 0.95);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.r + 5 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = rgba(rgb, 0.45 + 0.4 * Math.sin(t * 4));
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.r + 9 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.id === hoverId) {
          ctx.lineWidth = 1 * dpr;
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.r + 3.5 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        }
        const show = !pv && ((p.hub && !dim) || p.id === hoverId || p.id === selectedId || (selectedId && near.has(p.id) && front > 0.55) || (labels && front > 0.5 && !dim));
        if (show) {
          const fs = (p.hub ? 11.5 : 10) * dpr;
          ctx.font = `${p.hub ? 650 : 500} ${fs}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(236,238,248,${(p.hub ? 0.92 : 0.72) * alpha})`;
          ctx.fillText(p.label.length > 30 ? `${p.label.slice(0, 29)}…` : p.label, p.sx, p.sy + p.r + fs * 1.3);
        }
      }

      // Cluster names with counts, above each cluster.
      for (const { c, p: cp, depth, rad } of clusterProj) {
        // Just above the cluster on screen, whatever the tilt.
        const lp = { sx: cp.sx, sy: cp.sy - rad / 1.35 - 22 * dpr };
        const fade = Math.max(0.45, Math.min(1, (1.6 - depth) / 2.2));
        const text = c.label.toUpperCase().split("").join(String.fromCharCode(8202));
        ctx.textAlign = "center";
        ctx.font = `700 ${11.5 * dpr}px ${FONT}`;
        ctx.fillStyle = `rgba(214,204,255,${0.9 * fade})`;
        ctx.fillText(text, lp.sx, lp.sy);
        ctx.font = `500 ${10 * dpr}px ${FONT}`;
        ctx.fillStyle = `rgba(170,176,200,${0.8 * fade})`;
        ctx.fillText(`${c.count} item${c.count === 1 ? "" : "s"}`, lp.sx, lp.sy + 14 * dpr);
      }

      // Knowledge from outside: now and then a star far from the graph is pulled toward a source node. It starts as dull
      // as any other star and moves slowly and steadily, then speeds up and brightens as it nears the node, until it is
      // as bright as the node it hits.
      if (!reduce && now - lastComet > nextComet && comets.length < 3 && starPos.length) {
        lastComet = now;
        nextComet = 2800 + Math.random() * 3200;
        const targets = projected.filter((p) => p.type === "source" && p.depth < 1.4);
        // From outside: a star near the edge of the view, on the same side as the node, so it travels in from the
        // edge and never starts in (or crosses) the middle of the graph.
        const target = targets[Math.floor(Math.random() * targets.length)];
        const cxs = canvas.width / 2;
        const cys = canvas.height / 2;
        const band = Math.min(canvas.width, canvas.height) * 0.14;
        const far = target
          ? starPos.filter((s) => {
              const edge = Math.min(s.sx, s.sy, canvas.width - s.sx, canvas.height - s.sy);
              const sameSide = (s.sx - cxs) * (target.sx - cxs) + (s.sy - cys) * (target.sy - cys) > 0;
              // Out in the frame, not just near the top or bottom edge above the middle of a wide graph.
              const out = Math.hypot((s.sx - cxs) / cxs, (s.sy - cys) / cys) / Math.SQRT2;
              return edge < band && sameSide && out > 0.55;
            })
          : [];
        if (target && far.length) {
          const s = far[Math.floor(Math.random() * far.length)];
          caught.set(s.i, { back: t + 12 + Math.random() * 5 });
          comets.push({ x0: s.sx, y0: s.sy, size: s.size, a0: s.a, to: target.id, t0: t, dur: 5 + Math.random() * 2, trail: [] });
        }
      }
      const white: [number, number, number] = [255, 255, 255];
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        const tgt = byId.get(c.to);
        if (!tgt) {
          comets.splice(i, 1);
          continue;
        }
        // Slow and steady at first, then faster as it nears the node (the node keeps moving as the graph turns).
        const u = Math.min(1, (t - c.t0) / c.dur);
        const e = 0.3 * u + 0.7 * u * u * u;
        const x = c.x0 + (tgt.sx - c.x0) * e;
        const y = c.y0 + (tgt.sy - c.y0) * e;
        // Brightness and size grow with closeness: from the star it was to the node it meets.
        const k = Math.pow(e, 1.6);
        const alpha = c.a0 + (1 - c.a0) * k;
        const core = c.size * dpr * 0.6 * (1 - k) + tgt.r * k;
        c.trail.push([x, y]);
        if (c.trail.length > 26) c.trail.shift();
        if (k > 0.05) {
          ctx.lineCap = "round";
          for (let j = 1; j < c.trail.length; j++) {
            const a = (j / c.trail.length) * k;
            ctx.strokeStyle = rgba(white, a * 0.5);
            ctx.lineWidth = (0.3 + (j / c.trail.length) * 0.6) * dpr;
            ctx.beginPath();
            ctx.moveTo(c.trail[j - 1][0], c.trail[j - 1][1]);
            ctx.lineTo(c.trail[j][0], c.trail[j][1]);
            ctx.stroke();
          }
        }
        if (k > 0.04) {
          const glow = core * (1.5 + 2.2 * k);
          const g = ctx.createRadialGradient(x, y, 0, x, y, glow);
          g.addColorStop(0, rgba(white, 0.45 * k * alpha));
          g.addColorStop(1, rgba(white, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, glow, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = rgba(white, alpha);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5 * dpr, core), 0, Math.PI * 2);
        ctx.fill();
        if (u >= 1) {
          // Arrival: a gentle nudge along its path, a small flash and a thin ring.
          const ix = tgt.sx - c.x0;
          const iy = tgt.sy - c.y0;
          const il = Math.hypot(ix, iy) || 1;
          const o = offsets.get(c.to) ?? { ox: 0, oy: 0, vx: 0, vy: 0 };
          o.vx += (ix / il) * 120;
          o.vy += (iy / il) * 120;
          offsets.set(c.to, o);
          const bt = bounce.get(c.to) ?? { amp: 0, vel: 0 };
          bt.vel += 7;
          bounce.set(c.to, bt);
          impacts.push({ to: c.to, at: t, rgb: white });
          comets.splice(i, 1);
        }
      }
      for (let i = impacts.length - 1; i >= 0; i--) {
        const im = impacts[i];
        const p = byId.get(im.to);
        const k = (t - im.at) / 0.7;
        if (!p || k >= 1) {
          impacts.splice(i, 1);
          continue;
        }
        if (k < 0.3) {
          const fr = (p.r + 6 * dpr) * (1 + k);
          const fg = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, fr);
          fg.addColorStop(0, rgba(white, 0.7 * (1 - k / 0.3)));
          fg.addColorStop(1, rgba(white, 0));
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, fr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = rgba(im.rgb, 0.6 * (1 - k));
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.r + k * 18 * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hover card.
      const h = hoverId && !nodeDragId ? byId.get(hoverId) : undefined;
      if (h) {
        const w = (pv ? 190 : 240) * dpr;
        let tx = h.sx + h.r + 12 * dpr;
        if (tx + w > canvas.width) tx = h.sx - w - h.r - 12 * dpr;
        tx = Math.max(8 * dpr, Math.min(tx, canvas.width - w - 8 * dpr));
        const ty = h.sy - 30 * dpr;
        const rgb = rgbOf(colors[h.type] ?? "#a0aac0");
        ctx.fillStyle = "rgba(8,10,20,0.92)";
        ctx.strokeStyle = rgba(rgb, 0.6);
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tx, ty, w, 54 * dpr, 8 * dpr);
        else ctx.rect(tx, ty, w, 54 * dpr);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(rgb, 1);
        ctx.font = `700 ${10 * dpr}px ${FONT}`;
        ctx.fillText(`${h.type} · ${h.group}`.toUpperCase(), tx + 12 * dpr, ty + 19 * dpr);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `600 ${12.5 * dpr}px ${FONT}`;
        ctx.fillText(h.label.length > 32 ? `${h.label.slice(0, 31)}…` : h.label, tx + 12 * dpr, ty + 39 * dpr);
      }
      if (pv) drawCursor(now);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const local = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return { mx: e.clientX - r.left, my: e.clientY - r.top };
    };
    const onDown = (e: MouseEvent) => {
      const { mx, my } = local(e);
      const hit = hitTest(mx, my);
      dragging = true;
      didDrag = false;
      target = null;
      lastInteract = performance.now();
      if (hit) {
        nodeDragId = hit.id;
        const cur = offsets.get(hit.id) ?? { ox: 0, oy: 0, vx: 0, vy: 0 };
        nodeDragStart = { mx: e.clientX, my: e.clientY, ox: cur.ox, oy: cur.oy };
      } else {
        dragMode = e.shiftKey || e.button === 2 ? "pan" : "rotate";
        dragStart = { x: e.clientX, y: e.clientY, rotX, rotY, panX, panY };
      }
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      lastInteract = performance.now();
      if (dragging) {
        if (nodeDragId) {
          const dx = e.clientX - nodeDragStart.mx;
          const dy = e.clientY - nodeDragStart.my;
          if (Math.abs(dx) + Math.abs(dy) > 2) didDrag = true;
          offsets.set(nodeDragId, { ox: nodeDragStart.ox + dx, oy: nodeDragStart.oy + dy, vx: 0, vy: 0 });
          return;
        }
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) didDrag = true;
        if (didDrag) userMoved = true;
        if (dragMode === "pan") {
          panX = dragStart.panX + dx;
          panY = dragStart.panY + dy;
        } else {
          rotY = dragStart.rotY + dx * 0.005;
          rotX = Math.max(-1.15, Math.min(0.25, dragStart.rotX - dy * 0.005));
        }
        return;
      }
      if (e.target !== canvas) return;
      const { mx, my } = local(e);
      const id = hitTest(mx, my)?.id ?? null;
      if (id !== hoverId) {
        hoverId = id;
        canvas.style.cursor = id ? "pointer" : "grab";
      }
    };
    const onUp = (e: MouseEvent) => {
      if (!dragging) return;
      if (nodeDragId) {
        if (!didDrag) live.current.onSelect?.(nodeDragId);
        nodeDragId = null;
      } else if (!didDrag) {
        const { mx, my } = local(e);
        const id = hitTest(mx, my)?.id ?? null;
        live.current.onSelect?.(id);
        // Clicking empty space goes back to the framed view.
        if (!id) {
          userMoved = false;
          lastFit = -1e9;
          zoomTarget = homeZoom;
        }
      } else if (dragMode === "rotate") {
        rotYVel = (e.clientX - dragStart.x) * 0.02;
        rotXVel = -(e.clientY - dragStart.y) * 0.02;
      }
      dragging = false;
      canvas.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastInteract = performance.now();
      target = null;
      userMoved = true;
      zoom = zoomTarget = Math.max(0.5, Math.min(3.2, zoom * Math.exp(-e.deltaY * 0.001)));
    };
    const onLeave = () => {
      hoverId = null;
    };
    const noMenu = (e: Event) => e.preventDefault();
    if (live.current.preview) {
      // Look only: it turns on its own; the card around it handles the click.
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        seen.disconnect();
      };
    }
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("contextmenu", noMenu);
    canvas.style.cursor = "grab";
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      seen.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("contextmenu", noMenu);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />;
}
