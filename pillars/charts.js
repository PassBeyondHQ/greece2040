/* Greece 2040 shared chart helpers for pillar pages.
   Usage (inline <script> at the end of the page, after this file loads):
     G40.line('figId', {...});  G40.bar('figId', {...});
   Each chart lives in <figure class="chart" id="figId"> containing an <svg viewBox="0 0 W H">.
   Colours: 'var(--accent)' = Greece (always), 'var(--series-2)' = comparison (euro area / EU), 'var(--series-3)' = a third series only if unavoidable.
*/
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent && parent.appendChild(el); return el; };
  const label = (svg, x, y, text, anchor = 'middle', bold = true) => { mk('text', { x, y, 'text-anchor': anchor, fill: bold ? 'var(--ink)' : 'var(--muted)', 'font-size': bold ? 13 : 12, 'font-weight': bold ? 600 : 400, 'font-family': bold ? 'var(--f-body)' : 'var(--f-mono)' }, svg).textContent = text; };
  const tipFor = (fig) => { const t = document.createElement('div'); t.className = 'tip'; t.hidden = true; fig.style.position = 'relative'; fig.appendChild(t); return t; };
  const place = (fig, tip, svg, x, y, text) => {
    const r = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), s = r.width / svg.viewBox.baseVal.width;
    tip.textContent = text; tip.hidden = false; tip.style.left = (r.left - fr.left + x * s) + 'px'; tip.style.top = (r.top - fr.top + y * s) + 'px';
  };
  const tickText = (v, o) => (o.tickFmt ? o.tickFmt(v) : (v >= 1000 && o.k !== false ? (v / 1000) + 'k' : v.toLocaleString('en-GB')) + (o.unit || ''));

  /* Line chart.
     o = { x0, x1, y0, y1, yTicks:[...], xTicks:[...], unit:'%', tickFmt?(v),
           series:[{ name, color, data:[[x,y],...], dash?, area?, noHover? }],
           marks?:[[x, y, 'label', dy]], notes?:[[x, y, 'text', 'start'|'middle'|'end']],
           tip:(p)=>string  where p = [x, y, seriesName] }
     Hover snaps to whole x values. Use integer years on x. */
  const line = (id, o) => {
    const fig = document.getElementById(id), svg = fig.querySelector('svg'), tip = tipFor(fig);
    const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height, L = 48, R = 18, T = 18, B = 30;
    const x = (v) => L + (v - o.x0) / (o.x1 - o.x0) * (W - L - R), y = (v) => T + (1 - (v - o.y0) / (o.y1 - o.y0)) * (H - T - B);
    const g = mk('g', { class: 'grid' }, svg), ax = mk('g', { class: 'axis' }, svg);
    o.yTicks.forEach(v => { mk('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); mk('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax).textContent = tickText(v, o); });
    o.xTicks.forEach(v => mk('text', { x: x(v), y: H - 8, 'text-anchor': 'middle' }, ax).textContent = v);
    const path = (d) => d.map(([a, b], i) => (i ? 'L' : 'M') + x(a).toFixed(1) + ' ' + y(b).toFixed(1)).join(' ');
    o.series.slice().reverse().forEach(s => {
      if (!s.data.length) return;
      if (s.area) mk('path', { d: path(s.data) + ` L${x(s.data[s.data.length - 1][0])} ${y(o.y0)} L${x(s.data[0][0])} ${y(o.y0)} Z`, fill: s.color, 'fill-opacity': '.08' }, svg);
      mk('path', { d: path(s.data), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(s.dash ? { 'stroke-dasharray': '5 5', opacity: .75 } : {}) }, svg);
    });
    (o.marks || []).forEach(([a, b, text, dy]) => { mk('circle', { cx: x(a), cy: y(b), r: 5, fill: o.series[0].color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg); label(svg, x(a), y(b) + dy, text); });
    (o.notes || []).forEach(([a, b, text, anchor]) => label(svg, x(a), y(b), text, anchor || 'middle', false));
    const pts = o.series.filter(s => !s.noHover).flatMap(s => s.data.map(p => [...p, s.name]));
    const cross = mk('line', { y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-dasharray': '3 3', opacity: 0 }, svg);
    const hit = mk('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, py = (ev.clientY - r.top) / r.height * H;
      const xv = Math.round(o.x0 + (px - L) / (W - L - R) * (o.x1 - o.x0));
      const at = pts.filter(p => p[0] === xv); if (!at.length) return;
      const best = at.reduce((m, p) => Math.abs(y(p[1]) - py) < Math.abs(y(m[1]) - py) ? p : m);
      cross.setAttribute('x1', x(xv)); cross.setAttribute('x2', x(xv)); cross.setAttribute('opacity', 1);
      place(fig, tip, svg, x(xv), y(best[1]), o.tip(best));
    };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('opacity', 0); });
  };

  /* Bar chart (one or two series; vertical bars; values must be >= 0 unless o.min < 0).
     o = { data:[[label, a, b?],...], names?:['Greece','Euro area'], max, min?:0, ticks:[...], fmt:(v)=>string,
           highlightLast?:bool (single series: grey bars, last one blue), lastLabel?:'text' } */
  const bar = (id, o) => {
    const fig = document.getElementById(id), svg = fig.querySelector('svg'), tip = tipFor(fig);
    const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height, L = 48, R = 10, T = 22, B = 30, min = o.min || 0;
    const y = (v) => T + (1 - (v - min) / (o.max - min)) * (H - T - B);
    const g = mk('g', { class: 'grid' }, svg), ax = mk('g', { class: 'axis' }, svg);
    o.ticks.forEach(v => { mk('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g); mk('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax).textContent = o.fmt(v); });
    const two = o.data[0].length > 2, band = (W - L - R) / o.data.length, bw = Math.min(two ? 30 : 40, band * (two ? .3 : .55));
    const barAt = (cx, v, fill, text) => {
      const a = y(Math.max(v, 0)), b = y(Math.min(v, 0)), top = a, h = b - a, r = Math.min(4, h);
      const d = v >= 0
        ? `M${cx - bw / 2} ${b} V${top + r} Q${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top} H${cx + bw / 2 - r} Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r} V${b} Z`
        : `M${cx - bw / 2} ${a} V${b - r} Q${cx - bw / 2} ${b} ${cx - bw / 2 + r} ${b} H${cx + bw / 2 - r} Q${cx + bw / 2} ${b} ${cx + bw / 2} ${b - r} V${a} Z`;
      mk('path', { d, fill }, svg);
      const hit = mk('rect', { x: cx - Math.max(bw, 20) / 2 - 4, y: T, width: Math.max(bw, 20) + 8, height: H - T - B, fill: 'transparent' }, svg);
      const on = () => place(fig, tip, svg, cx, v >= 0 ? top : b, text); hit.addEventListener('pointerenter', on); hit.addEventListener('pointerdown', on);
      hit.addEventListener('pointerleave', () => tip.hidden = true);
    };
    if (min < 0) mk('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: 'var(--muted)' }, svg);
    o.data.forEach((d, i) => {
      const cx = L + band * (i + .5);
      if (two) { barAt(cx - bw / 2 - 1, d[1], 'var(--accent)', d[0] + ' ' + o.names[0] + ': ' + o.fmt(d[1])); barAt(cx + bw / 2 + 1, d[2], 'var(--series-2)', d[0] + ' ' + o.names[1] + ': ' + o.fmt(d[2])); }
      else barAt(cx, d[1], i === o.data.length - 1 || !o.highlightLast ? 'var(--accent)' : 'var(--series-2)', d[0] + ': ' + o.fmt(d[1]));
      if (o.data.length <= 16 || i % 2 === 0) mk('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, ax).textContent = d[0];
    });
    if (o.lastLabel) { const d = o.data[o.data.length - 1]; label(svg, L + band * (o.data.length - .5), y(d[1]) - 8, o.lastLabel); }
  };

  /* Horizontal ranked bars (e.g. Greece vs EU countries). Greece row is blue, others grey.
     o = { rows:[['Greece', 4.2], ['Italy', 3.1], ...] (pre-sorted), max, fmt:(v)=>string, highlight:'Greece' } */
  const hbar = (id, o) => {
    const fig = document.getElementById(id), svg = fig.querySelector('svg'), tip = tipFor(fig);
    const W = svg.viewBox.baseVal.width, rowH = 26, L = 130, R = 60, T = 6;
    svg.setAttribute('viewBox', `0 0 ${W} ${T * 2 + o.rows.length * rowH}`);
    o.rows.forEach(([name, v], i) => {
      const yy = T + i * rowH, w = Math.max(2, v / o.max * (W - L - R)), hi = name === (o.highlight || 'Greece');
      mk('text', { x: L - 10, y: yy + 17, 'text-anchor': 'end', fill: hi ? 'var(--ink)' : 'var(--ink-2)', 'font-size': 13, 'font-weight': hi ? 700 : 400, 'font-family': 'var(--f-body)' }, svg).textContent = name;
      mk('rect', { x: L, y: yy + 5, width: w, height: 16, rx: 3, fill: hi ? 'var(--accent)' : 'var(--series-2)' }, svg);
      mk('text', { x: L + w + 6, y: yy + 17, fill: 'var(--ink-2)', 'font-size': 12, 'font-family': 'var(--f-mono)' }, svg).textContent = o.fmt(v);
    });
  };

  window.G40 = { line, bar, hbar };
})();
