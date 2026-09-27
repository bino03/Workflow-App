// Gera os tokens --wfa-* a partir de definições OKLCH. Usado pelos protótipos e pelo README.
function toLin(L, C, H) {
  const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inG = v => v.every(x => x >= -0.0005 && x <= 1.0005);
const gam = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
export function oklch(L, C, H) {
  let c = C;
  if (!inG(toLin(L, c, H))) { let lo = 0, hi = C; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inG(toLin(L, mid, H))) lo = mid; else hi = mid; } c = lo; }
  return '#' + toLin(L, c, H).map(v => Math.round(Math.min(1, Math.max(0, gam(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function lum(hex) { const n = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]; }
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const grade = r => r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA grande' : 'falha';

const LV = [0.96, 0.87, 0.77, 0.67, 0.56, 0.45, 0.35, 0.26, 0.19];
const ST_A = { work: [0.80, 0.16, 152], wait: [0.83, 0.155, 72], stop: [0.68, 0.012, 250], err: [0.70, 0.185, 25] };
export const DEFS = {
  gelo: { nome: 'Gelo', sub: 'Aço frio, acento gelo. O mais sóbrio: a cor fica quase toda para os estados.', nH: 250, nC: 0.012, a: [0.83, 0.095, 220], st: ST_A, sem: { success: 152, warning: 72, error: 25, info: 240 } },
  violeta: { nome: 'Violeta', sub: 'Preto azulado, acento violeta elétrico. Foco e ações muito evidentes.', nH: 280, nC: 0.016, a: [0.72, 0.16, 292], st: { ...ST_A, stop: [0.68, 0.014, 280] }, sem: { success: 152, warning: 72, error: 25, info: 240 } },
  sinal: { nome: 'Sinal', sub: 'Preto quente, acento amarelo-sinal. Mais dramático; estados em ciano e magenta.', nH: 75, nC: 0.008, a: [0.88, 0.16, 95], st: { work: [0.80, 0.13, 212], wait: [0.74, 0.20, 350], stop: [0.68, 0.01, 75], err: [0.70, 0.19, 22] }, sem: { success: 155, warning: 62, error: 22, info: 212 } },
};
export const STATE_NAMES = { work: 'A trabalhar', wait: 'À tua espera', stop: 'Terminado', err: 'Erro / desligado' };
export const STATE_SHAPES = { work: 'arco (roda devagar)', wait: 'losango cheio', stop: 'quadrado vazio', err: '✕' };
const kebab = s => s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

const cache = {};
export function build(id) {
  if (cache[id]) return cache[id];
  const p = DEFS[id], N = (L, k = 1) => oklch(L, p.nC * k, p.nH), [aL, aC, aH] = p.a, A = (L, c = aC) => oklch(L, c, aH);
  const t = {
    bg: N(0.145), 'surface-1': N(0.178), 'surface-2': N(0.212), 'surface-3': N(0.248), border: N(0.29), 'border-strong': N(0.38),
    'text-1': N(0.955, 0.5), 'text-2': N(0.80), 'text-3': N(0.685),
    accent: A(aL), 'accent-hover': A(Math.min(0.95, aL + 0.06)), 'accent-pressed': A(aL - 0.07), 'accent-subtle': A(0.27, aC * 0.3), 'accent-border': A(0.45, aC * 0.6), 'on-accent': N(0.16),
  };
  for (const k in p.sem) t[k] = oklch(0.78, 0.14, p.sem[k]);
  const st = {};
  for (const k in p.st) { const [L, C, H] = p.st[k]; st[k] = oklch(L, C, H); st[k + '-subtle'] = oklch(0.25, C * 0.28, H); st[k + '-border'] = oklch(0.46, C * 0.6, H); }
  const neutral = LV.map(L => N(L)), accent = LV.map(L => A(L));
  const ansi = {
    black: N(0.62, 2), red: oklch(0.70, 0.17, 25), green: oklch(0.78, 0.16, 150), yellow: oklch(0.85, 0.15, 92), blue: oklch(0.72, 0.13, 255), magenta: oklch(0.73, 0.16, 330), cyan: oklch(0.80, 0.12, 205), white: N(0.86),
    brightBlack: N(0.71, 2), brightRed: oklch(0.78, 0.15, 25), brightGreen: oklch(0.86, 0.15, 150), brightYellow: oklch(0.92, 0.14, 95), brightBlue: oklch(0.80, 0.11, 255), brightMagenta: oklch(0.81, 0.13, 330), brightCyan: oklch(0.88, 0.10, 205), brightWhite: N(0.975, 0.5),
  };
  const xterm = { background: t.bg, foreground: N(0.90, 0.5), cursor: t.accent, cursorAccent: t.bg, selectionBackground: A(0.36, aC * 0.4), ...ansi };
  const vars = {};
  for (const k in t) vars['--wfa-color-' + k] = t[k];
  neutral.forEach((h, i) => vars['--wfa-neutral-' + (i + 1) * 100] = h);
  accent.forEach((h, i) => vars['--wfa-accent-' + (i + 1) * 100] = h);
  for (const k in st) vars['--wfa-state-' + k] = st[k];
  for (const k in ansi) vars['--wfa-ansi-' + kebab(k)] = ansi[k];
  Object.assign(vars, {
    '--wfa-term-bg': xterm.background, '--wfa-term-fg': xterm.foreground, '--wfa-term-cursor': xterm.cursor, '--wfa-term-selection': xterm.selectionBackground,
    '--wfa-radius-sm': '3px', '--wfa-radius-md': '5px', '--wfa-radius-lg': '8px',
    '--wfa-shadow-1': '0 1px 2px rgba(0,0,0,.5)', '--wfa-shadow-overlay': '0 24px 64px rgba(0,0,0,.6), 0 0 0 1px ' + t['border-strong'],
    '--wfa-color-mask': 'rgba(0,0,0,.62)',
  });
  const sw = (name, hex) => ({ name, hex, st: { width: 28, height: 28, borderRadius: 4, background: hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', flex: 'none' } });
  const pairs = [['text-1', 'bg'], ['text-2', 'bg'], ['text-3', 'bg'], ['text-2', 'surface-2'], ['text-3', 'surface-3'], ['accent', 'bg'], ['on-accent', 'accent'], ['accent', 'surface-2']];
  const r2 = r => r.toFixed(1) + ':1';
  const res = {
    id, nome: p.nome, sub: p.sub, tokens: t, states: st, neutral, accent, ansi, xterm, vars,
    core: ['bg', 'surface-1', 'surface-2', 'surface-3', 'border', 'border-strong', 'text-1', 'text-2', 'text-3', 'accent', 'accent-hover', 'accent-subtle'].map(k => sw(k, t[k])),
    semantic: ['success', 'warning', 'error', 'info'].map(k => ({ ...sw(k, t[k]), ratio: r2(contrast(t[k], t['surface-1'])) })),
    stateList: ['work', 'wait', 'stop', 'err'].map(k => ({ key: k, name: STATE_NAMES[k], shape: STATE_SHAPES[k], hex: st[k], ratio: r2(contrast(st[k], t['surface-1'])), ratioSubtle: r2(contrast(st[k], st[k + '-subtle'])), st: { color: st[k] }, chip: { width: 12, height: 12, borderRadius: 3, background: st[k], flex: 'none' } })),
    contrasts: pairs.map(([a, b]) => { const r = contrast(t[a], t[b]); return { pair: a + ' / ' + b, ratio: r2(r), grade: grade(r) }; }),
    ansiList: Object.keys(ansi).map(k => { const r = contrast(ansi[k], xterm.background); return { name: k, hex: ansi[k], ratio: r2(r), grade: grade(r), st: { color: ansi[k] } }; }),
    neutralList: neutral.map((h, i) => ({ step: (i + 1) * 100, hex: h, st: { flex: 1, height: 44, background: h, color: i < 4 ? t.bg : t['text-1'], padding: '6px 8px', fontSize: 10.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } })),
    accentList: accent.map((h, i) => ({ step: (i + 1) * 100, hex: h, st: { flex: 1, height: 44, background: h, color: i < 4 ? t.bg : t['text-1'], padding: '6px 8px', fontSize: 10.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } })),
  };
  cache[id] = res;
  return res;
}

export const TYPES = {
  plex: { id: 'plex', nome: 'Plex', desc: 'IBM Plex Sans + IBM Plex Mono. Técnico e neutro; zero com ponto, l com cauda.', display: "'IBM Plex Sans', sans-serif", sans: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace", dispCase: 'none', dispTrack: '-0.01em' },
  geist: { id: 'geist', nome: 'Geist', desc: 'Geist + Geist Mono. Contemporâneo e compacto; zero cortado.', display: "'Geist', sans-serif", sans: "'Geist', sans-serif", mono: "'Geist Mono', monospace", dispCase: 'none', dispTrack: '-0.02em' },
  consola: { id: 'consola', nome: 'Consola', desc: 'Chakra Petch (títulos) + Barlow (corpo) + JetBrains Mono. O mais "consola"; mono muito legível a 13 px.', display: "'Chakra Petch', sans-serif", sans: "'Barlow', sans-serif", mono: "'JetBrains Mono', monospace", dispCase: 'uppercase', dispTrack: '0.04em' },
};
export function typeVars(tid) {
  const t = TYPES[tid];
  return { '--wfa-font-display': t.display, '--wfa-font-sans': t.sans, '--wfa-font-mono': t.mono, '--wfa-display-case': t.dispCase, '--wfa-display-tracking': t.dispTrack };
}
