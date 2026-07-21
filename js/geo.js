// geo.js — GPS math shared by the whole app.
// Everything here works in plain lat/lng degrees + meters. No dependencies.

const Geo = (() => {
  const R = 6371000; // earth radius, meters

  function toRad(d) { return (d * Math.PI) / 180; }

  // Great-circle distance between two lat/lng points, in meters.
  function haversine(lat1, lng1, lat2, lng2) {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Local flat-earth projection around a reference point, good enough for
  // track-length distances (a few km at most). Returns meters.
  function makeLocalProjector(refLat) {
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(toRad(refLat));
    return {
      toXY(lat, lng) {
        return { x: (lng) * mPerDegLng, y: (lat) * mPerDegLat };
      },
    };
  }

  // Build a track object from a raw list of {lat,lng} points captured while
  // driving a lap. Produces cumulative distance along the line and a local
  // XY projection for fast math + drawing.
  function buildTrack(rawPoints, name) {
    if (rawPoints.length < 2) throw new Error('Need at least 2 points to build a track');
    const refLat = rawPoints[0].lat;
    const proj = makeLocalProjector(refLat);
    const points = [];
    let cum = 0;
    for (let i = 0; i < rawPoints.length; i++) {
      const p = rawPoints[i];
      const xy = proj.toXY(p.lat, p.lng);
      if (i > 0) {
        const prev = points[i - 1];
        cum += Math.hypot(xy.x - prev.x, xy.y - prev.y);
      }
      points.push({ lat: p.lat, lng: p.lng, x: xy.x, y: xy.y, dist: cum });
    }
    return {
      id: 'track_' + Date.now(),
      name: name || 'Untitled track',
      refLat,
      points,
      totalLength: cum,
      sectors: [], // array of {name, dist} — split points along the track
      createdAt: Date.now(),
    };
  }

  // Project a live lat/lng onto the nearest segment of the track.
  // Returns { dist, lateral, segIndex } where dist = distance-along-track (m),
  // lateral = perpendicular offset from the line (m, unsigned).
  function projectOntoTrack(track, lat, lng) {
    const proj = makeLocalProjector(track.refLat);
    const p = proj.toXY(lat, lng);
    let best = null;
    for (let i = 0; i < track.points.length - 1; i++) {
      const a = track.points[i];
      const b = track.points[i + 1];
      const abx = b.x - a.x, aby = b.y - a.y;
      const segLenSq = abx * abx + aby * aby;
      if (segLenSq === 0) continue;
      let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / segLenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = a.x + t * abx, projY = a.y + t * aby;
      const lateral = Math.hypot(p.x - projX, p.y - projY);
      if (!best || lateral < best.lateral) {
        best = {
          lateral,
          dist: a.dist + t * (b.dist - a.dist),
          segIndex: i,
        };
      }
    }
    return best;
  }

  // Speed in km/h from two timestamped fixes, used when the GPS doesn't
  // report coords.speed directly.
  function speedFromFixes(prev, curr) {
    const dt = (curr.t - prev.t) / 1000;
    if (dt <= 0) return 0;
    const d = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    return (d / dt) * 3.6;
  }

  return { haversine, buildTrack, projectOntoTrack, speedFromFixes, makeLocalProjector, toRad };
})();
