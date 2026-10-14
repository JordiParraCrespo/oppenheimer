// Same geometry and classes as the design system AreaChart, drawn with a monotone cubic curve (no overshoot).
const pad = { t: 10, r: 8, b: 22, l: 34 };
const scale = (v, min, max, a, b) => (max === min ? (a + b) / 2 : a + ((v - min) / (max - min)) * (b - a));

function monotonePath(p) {
  if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : '';
  const n = p.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let out = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1][0] - p[i][0]) / 3;
    out += ` C${p[i][0] + h},${p[i][1] + m[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - m[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return out;
}

function CurvedAreaChart({ series = [], labels = [], height = 200, area = true, yTicks = 4, yFormat = (v) => v, className = '', ...rest }) {
  const w = 640, h = height;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 0) * 1.08 || 1, min = 0;
  const n = Math.max(labels.length, ...series.map((s) => s.data.length));
  const x = (i) => scale(i, 0, Math.max(n - 1, 1), pad.l, w - pad.r);
  const y = (v) => scale(v, min, max, h - pad.b, pad.t);
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + ((max - min) / yTicks) * i);
  const e = React.createElement;
  return e('svg', { className: ['op-chart', className].filter(Boolean).join(' '), viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', style: { height }, role: 'img', ...rest },
    ticks.map((t, i) => e('g', { key: 't' + i },
      e('line', { className: 'op-chart__grid', x1: pad.l, x2: w - pad.r, y1: y(t), y2: y(t) }),
      e('text', { className: 'op-chart__axis', x: pad.l - 8, y: y(t) + 3, textAnchor: 'end' }, yFormat(Math.round(t))))),
    labels.map((l, i) => e('text', { key: 'l' + i, className: 'op-chart__axis', x: x(i), y: h - 6, textAnchor: 'middle' }, l)),
    series.map((s, si) => {
      const color = s.color || `var(--chart-${(si % 5) + 1})`;
      const pts = s.data.map((v, i) => [x(i), y(v)]);
      const line = monotonePath(pts);
      return e('g', { key: s.name || si },
        area && pts.length > 1 && e('path', { d: `${line} L${pts[pts.length - 1][0]},${y(min)} L${pts[0][0]},${y(min)} Z`, fill: color, opacity: series.length > 1 ? 0.08 : 0.12 }),
        e('path', { className: 'op-chart__line', d: line, stroke: color, fill: 'none', vectorEffect: 'non-scaling-stroke' }));
    }));
}

module.exports = { CurvedAreaChart };
