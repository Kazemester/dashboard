// Appearance: a preset theme plus optional custom background / highlight colours.
export const THEMES = {
  jarvis: { name: 'JARVIS', bg: '#020406', accent: '#67e8f9' },
  amber: { name: 'Borostyán', bg: '#0a0703', accent: '#fbbf24' },
  alert: { name: 'Vörös riasztás', bg: '#080203', accent: '#f43f5e' },
  terminal: { name: 'Terminál', bg: '#010603', accent: '#4ade80' },
  violet: { name: 'Ibolya', bg: '#05030a', accent: '#a78bfa' },
  graphite: { name: 'Grafit', bg: '#070707', accent: '#e5e5e5' },
  light: { name: 'Világos', bg: '#f3f5f7', accent: '#0e7490' },
};
export const DEFAULT_APPEARANCE = { theme: 'jarvis', bg: null, accent: null };

// Decorative animations: the saved choice wins; with none saved they follow the OS "reduce motion" setting.
export const animEnabled = (a = DEFAULT_APPEARANCE) =>
  typeof a.anim === 'boolean' ? a.anim : !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const hexToRgba = (hex, a = 1) => (HEX.test(hex) ? `rgba(${rgb(hex).join(', ')}, ${a})` : hex);
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Resolve the effective colours; text colours follow the background's lightness.
export function resolveAppearance(a = DEFAULT_APPEARANCE) {
  const t = THEMES[a.theme] ?? THEMES.jarvis;
  const bg = HEX.test(a.bg ?? '') ? a.bg : t.bg;
  const accent = HEX.test(a.accent ?? '') ? a.accent : t.accent;
  const light = luminance(bg) > 0.4;
  return {
    bg,
    accent,
    scheme: light ? 'light' : 'dark',
    text: light ? '#111827' : '#d5e4ea',
    muted: light ? '#6b7280' : '#5f6e76',
    danger: light ? '#dc2626' : '#f87171',
  };
}

const STORE = 'nexus:appearance';
export function applyAppearance(a) {
  const r = resolveAppearance(a);
  const s = document.documentElement.style;
  s.setProperty('--bg', r.bg);
  s.setProperty('--accent', r.accent);
  s.setProperty('--text', r.text);
  s.setProperty('--muted', r.muted);
  s.setProperty('--danger', r.danger);
  s.setProperty('color-scheme', r.scheme);
  document.documentElement.dataset.scheme = r.scheme;
  document.documentElement.dataset.anim = animEnabled(a) ? 'on' : 'off';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r.bg);
  try {
    localStorage.setItem(STORE, JSON.stringify(a)); // lets the next page load start in the right colours
  } catch {
    /* ignore */
  }
  return r;
}

export function cachedAppearance() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

// Current values for things that cannot read CSS variables (e.g. the TradingView iframe).
export const currentAppearance = () => resolveAppearance(cachedAppearance());
