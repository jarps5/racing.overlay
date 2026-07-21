// widgets.js — the catalog of widget types the dashboard can render.
// Every render(el, data, colors) fully rebuilds its own inner content —
// simple and cheap enough at 1-5 updates/sec.
//
// Expected shape of `data` (recorder.js and overlay.js both build this):
// {
//   speed, lapTime, delta, lapNumber, bestLapTime,
//   sectorSplits: { 'S1': {time, delta}, ... },
//   track: { sectors:[{name,dist}], points:[...], totalLength },
//   liveDist, accuracy
// }

function styleWidget(el, colors) {
  el.style.color = colors.text;
}

const WidgetRegistry = {
  speed: {
    label: 'Speed',
    defaultW: 26, defaultH: 18,
    render(el, data, colors) {
      styleWidget(el, colors);
      el.innerHTML = `
        <div class="w-label" style="color:${colors.text}99">SPEED</div>
        <div class="w-big mono" style="color:${colors.accent}">${Math.round(data.speed || 0)}</div>
        <div class="w-unit" style="color:${colors.text}99">km/h</div>`;
    },
  },

  delta: {
    label: 'Delta vs best',
    defaultW: 26, defaultH: 18,
    render(el, data, colors) {
      styleWidget(el, colors);
      const d = data.delta;
      const color = d == null ? colors.text : (d <= 0 ? '#21c567' : '#e4432c');
      el.innerHTML = `
        <div class="w-label" style="color:${colors.text}99">DELTA</div>
        <div class="w-big mono" style="color:${color}">${d == null ? '--.--' : fmtDelta(d)}</div>`;
    },
  },

  elapsed: {
    label: 'Lap time',
    defaultW: 30, defaultH: 16,
    render(el, data, colors) {
      styleWidget(el, colors);
      el.innerHTML = `
        <div class="w-label" style="color:${colors.text}99">LAP TIME</div>
        <div class="w-mid mono" style="color:${colors.accent}">${fmtTime(data.lapTime)}</div>`;
    },
  },

  bestlap: {
    label: 'Best lap',
    defaultW: 30, defaultH: 16,
    render(el, data, colors) {
      styleWidget(el, colors);
      el.innerHTML = `
        <div class="w-label" style="color:${colors.text}99">BEST LAP</div>
        <div class="w-mid mono" style="color:${colors.accent}">${data.bestLapTime == null ? '--:--.---' : fmtTime(data.bestLapTime)}</div>`;
    },
  },

  lapcounter: {
    label: 'Lap counter',
    defaultW: 18, defaultH: 16,
    render(el, data, colors) {
      styleWidget(el, colors);
      el.innerHTML = `
        <div class="w-label" style="color:${colors.text}99">LAP</div>
        <div class="w-mid mono" style="color:${colors.accent}">${data.lapNumber || 0}</div>`;
    },
  },

  accuracy: {
    label: 'GPS accuracy',
    defaultW: 22, defaultH: 14,
    render(el, data, colors) {
      styleWidget(el, colors);
      el.innerHTML = `
        <div class="w-label" style="color:${colors.text}99">GPS</div>
        <div class="w-small mono" style="color:${colors.accent}">${data.accuracy == null ? '--' : Math.round(data.accuracy) + ' m'}</div>`;
    },
  },

  sectors: {
    label: 'Sector lights',
    defaultW: 60, defaultH: 14,
    render(el, data, colors) {
      styleWidget(el, colors);
      const sectors = (data.track && data.track.sectors) || [];
      if (!sectors.length) {
        el.innerHTML = `<div class="w-label" style="color:${colors.text}99">No sectors on this track</div>`;
        return;
      }
      const splits = data.sectorSplits || {};
      el.innerHTML = `<div class="w-sectors">${sectors.map((s) => {
        const split = splits[s.name];
        let bg = 'rgba(255,255,255,0.08)';
        let fg = colors.text;
        if (split) { bg = split.delta <= 0 ? '#21c567' : '#e4432c'; fg = '#0b0d10'; }
        return `<div class="w-sector-chip" style="background:${bg};color:${fg};">${s.name}${split ? ' ' + fmtDelta(split.delta) : ''}</div>`;
      }).join('')}</div>`;
    },
  },

  trackmap: {
    label: 'Track map',
    defaultW: 32, defaultH: 32,
    render(el, data, colors) {
      styleWidget(el, colors);
      const track = data.track;
      if (!track || !track.points || !track.points.length) {
        el.innerHTML = `<div class="w-label" style="color:${colors.text}99">No track loaded</div>`;
        return;
      }
      let canvas = el.querySelector('canvas');
      if (!canvas) {
        el.innerHTML = '<canvas></canvas>';
        canvas = el.querySelector('canvas');
      }
      const rect = el.getBoundingClientRect();
      canvas.width = Math.max(60, rect.width);
      canvas.height = Math.max(60, rect.height);
      const ctx = canvas.getContext('2d');
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      track.points.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      const pad = 10;
      const w = canvas.width - pad * 2, h = canvas.height - pad * 2;
      const scale = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1));
      const toXY = (p) => ({ x: pad + (p.x - minX) * scale, y: canvas.height - pad - (p.y - minY) * scale });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = colors.text + '88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      track.points.forEach((p, i) => { const c = toXY(p); if (i === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y); });
      ctx.stroke();

      track.sectors.forEach((s) => {
        const pt = pointAtDistGeneric(track, s.dist);
        const c = toXY(pt);
        ctx.fillStyle = colors.accent;
        ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2); ctx.fill();
      });

      if (data.liveDist != null) {
        const pt = pointAtDistGeneric(track, data.liveDist);
        const c = toXY(pt);
        ctx.fillStyle = colors.accent;
        ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0b0d10'; ctx.lineWidth = 2; ctx.stroke();
      }
    },
  },
};

function pointAtDistGeneric(track, dist) {
  const pts = track.points;
  if (dist <= pts[0].dist) return pts[0];
  if (dist >= pts[pts.length - 1].dist) return pts[pts.length - 1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (dist >= pts[i].dist && dist <= pts[i + 1].dist) {
      const t = (dist - pts[i].dist) / (pts[i + 1].dist - pts[i].dist || 1);
      return { x: pts[i].x + t * (pts[i + 1].x - pts[i].x), y: pts[i].y + t * (pts[i + 1].y - pts[i].y) };
    }
  }
  return pts[pts.length - 1];
}
