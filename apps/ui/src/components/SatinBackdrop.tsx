/**
 * Satin waves: lit, layered waves rolling in from a hazy horizon, with a light that follows the cursor and swells on a
 * click. FlowCode's own WebGL shader (the look after React Bits' "Gradient Waves"; none of its code, which its licence
 * keeps out of a product that redistributes components). Each layer is a sum of slow sines; its slope shades it like
 * satin, the horizon fades into haze, and a fine grain keeps the gradients from banding. In the app's brand colors. It
 * draws only while on screen and in a visible tab, holds one still frame for people who ask for reduced motion, stops
 * on Pause, and leaves a plain gradient where WebGL isn't available.
 */
import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uHeat;uniform float uFlare;
uniform vec3 uBase;uniform vec3 uMid;uniform vec3 uGlow;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
// A wave layer's height at x, and its slope.
vec2 wave(float x,float i,float t){
 float f1=1.1+i*.35,f2=2.3+i*.5,f3=.55+i*.2;
 float h=.11*sin(x*f1+t*(.35+i*.06)+i*1.9)+.05*sin(x*f2-t*(.5+i*.05)+i*4.1)+.07*sin(x*f3+t*.2+i*.7);
 float d=.11*f1*cos(x*f1+t*(.35+i*.06)+i*1.9)+.05*f2*cos(x*f2-t*(.5+i*.05)+i*4.1)+.07*f3*cos(x*f3+t*.2+i*.7);
 return vec2(h,d);
}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes;
 float ar=uRes.x/uRes.y;
 vec2 p=vec2(uv.x*ar,uv.y);
 float t=uTime;
 float aa=1.5/uRes.y;
 vec2 m=vec2(uMouse.x+.5*ar,uMouse.y+.5);
 // The sky: dark at the top, a haze of the brand color low over the horizon.
 vec3 col=mix(uMid*.9,uBase,smoothstep(.25,.95,uv.y));
 for(int k=0;k<5;k++){
  float i=float(k);
  float y0=.62-i*.12;
  vec2 w=wave(p.x*1.6+i*3.3,i,t);
  float top=y0+w.x*(.7+i*.15);
  float inside=smoothstep(top+aa,top-aa,p.y);
  if(inside<=0.)continue;
  // Satin: the slope tips the surface toward or away from the light; the sheen runs along the crest.
  vec3 n=normalize(vec3(-w.y*1.4,1.,.6));
  vec3 L=normalize(vec3(m.x-p.x,m.y-p.y+.4,.9));
  float diff=.55+.75*max(dot(n,L),0.);
  float depth=clamp((top-p.y)*3.,0.,1.);
  float sheen=pow(max(dot(n,normalize(L+vec3(0.,0.,1.))),0.),7.)*(1.-depth*.6);
  float front=i/4.;
  vec3 c=mix(uMid*1.25,uGlow,front*.55+.2);
  c=mix(c,uBase,depth*.4);
  c*=diff;
  float d=length(p-m);
  float lamp=(.25+.75*uHeat)*exp(-d*d*3.)+uFlare*1.2*exp(-d*d*1.1);
  c+=uGlow*sheen*(.55+lamp*1.6)+vec3(1.)*sheen*(.08+lamp*.45);
  c+=uGlow*lamp*.12*(1.-depth);
  // Far layers sit in the haze.
  c=mix(c,uMid*.8+uGlow*.15,(1.-front)*.35);
  col=mix(col,c,inside);
 }
 col+=(hash(gl_FragCoord.xy+fract(t))-.5)*.035;
 gl_FragColor=vec4(col,1.);
}`;

/** "#rrggbb" or "rgb(r, g, b)" → [0..1]×3; the fallback when the value can't be read. */
function rgb(v: string, fallback: [number, number, number]): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16) / 255) as [number, number, number];
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (m) return m[1]!.split(",").slice(0, 3).map((x) => Number(x.trim()) / 255) as [number, number, number];
  return fallback;
}

export function SatinBackdrop({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const gl = el.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      el.parentElement?.classList.add("satin--static");
      return;
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      el.parentElement?.classList.add("satin--static");
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"), uTime = u("uTime"), uMouse = u("uMouse"), uHeat = u("uHeat"), uFlare = u("uFlare");

    // FlowCode's brand colors, read from its tokens: a deep base, the indigo for the waves, the light blue for the light.
    const cs = getComputedStyle(document.documentElement);
    gl.uniform3fv(u("uBase"), rgb(cs.getPropertyValue("--bg-0") || "#0d1119", [0.05, 0.06, 0.1]).map((x) => x * 0.9));
    gl.uniform3fv(u("uMid"), rgb(cs.getPropertyValue("--brand-1"), [0.23, 0.25, 0.77]).map((x) => x * 0.85));
    gl.uniform3fv(u("uGlow"), rgb(cs.getPropertyValue("--brand-2"), [0.36, 0.6, 0.82]));

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = () => {
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(el.clientWidth * ratio));
      const h = Math.max(1, Math.round(el.clientHeight * ratio));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };
    size();

    // The light follows the cursor; a click swells it, fading over about a second.
    const mouse = { x: 0, y: 0, heat: 0, target: 0, flare: 0 };
    const toUv = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mouse.x = (e.clientX - r.left - r.width / 2) / r.height;
      mouse.y = (r.height / 2 - (e.clientY - r.top)) / r.height;
    };
    const onMove = (e: PointerEvent) => (toUv(e), (mouse.target = 1));
    const onLeave = () => (mouse.target = 0);
    const onDown = (e: PointerEvent) => (toUv(e), (mouse.flare = 1));
    addEventListener("pointermove", onMove);
    addEventListener("pointerdown", onDown);
    document.addEventListener("pointerleave", onLeave);

    let visible = true;
    const io = new IntersectionObserver((entries) => (visible = entries.some((e) => e.isIntersecting)));
    io.observe(el);
    const ro = new ResizeObserver(size);
    ro.observe(el);

    let raf = 0;
    let t = 4;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && visible && !document.hidden) {
        t += dt;
        mouse.heat += (mouse.target - mouse.heat) * Math.min(1, dt * 4);
        mouse.flare *= Math.pow(0.04, dt);
        draw();
      }
      raf = requestAnimationFrame(frame);
    };
    const draw = () => {
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uHeat, mouse.heat);
      gl.uniform1f(uFlare, mouse.flare);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Reduced motion: one still frame, redrawn only when the size changes.
    if (reduced) {
      draw();
      ro.disconnect();
      const still = new ResizeObserver(() => (size(), draw()));
      still.observe(el);
      return () => still.disconnect();
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="satin" aria-hidden="true">
      <canvas ref={canvas} className="satin__canvas" />
    </div>
  );
}
