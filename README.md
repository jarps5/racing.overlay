# Racing Overlay

A free, browser-only racing telemetry app: map a track (drive it or draw it
on a real map), record laps with live speed/delta/sector timing on your
phone, and stream a fully custom-designed overlay into OBS. No app installs,
no paid backend, no Google Maps billing.

## How it fits together

- **Track Editor** (phone or PC) — either drive one lap to auto-map the
  track from GPS, or draw it directly on a satellite/street map (click to
  place points — free, no API key, via OpenStreetMap/Esri tiles). Then
  click along the line to drop sector splits.
- **Recorder** (phone, in the car) — a fully customizable live dashboard:
  speed, delta, lap timer, best lap, sector lights, mini track map. Drag
  widgets anywhere, resize them, recolor them, add/remove with the `+`
  button. Saves every lap to the phone's local storage and streams the
  current instant to...
- **Overlay** (PC, as an OBS Browser Source) — the same widget system,
  transparent background, laid out independently from the phone's
  dashboard. **You can redesign the overlay from your phone, laptop, or any
  browser and OBS updates live** — layout is synced through the session's
  Firebase room, not local browser storage (OBS's Browser Source has its
  own private storage, so local-only edits wouldn't reach it otherwise).
- **Analytics** (any device) — compare laps, speed-vs-distance and
  delta-vs-distance charts, export/import laps as JSON.

Tracks and laps are stored **locally on whichever device recorded them**
(browser IndexedDB) — nothing is uploaded anywhere except the live
instant-by-instant packet and the overlay layout, both of which pass
through Firebase and aren't kept as history.

## Step 1 — Put it on GitHub Pages (free hosting)

1. Create a GitHub repo, e.g. `racing-overlay`.
2. Unzip this project on your computer first. Open the **unzipped folder**
   so you can see `index.html`, `css/`, `js/`, etc. directly — then upload
   *those items*, not the folder itself, so they land at the repo root
   (not nested inside another `racing-overlay/` folder).
3. **Settings → Pages → Build and deployment → Deploy from a branch → main
   → / (root)** → Save.
4. Wait 1–2 minutes, then check the **Actions** tab for a green checkmark
   on "pages build and deployment".
5. Your site is now at `https://yourusername.github.io/racing-overlay/`.

## Step 2 — Wire up the live link (Firebase, free)

Only needed for the *live* phone → OBS link. Mapping, recording, and
analytics all work without it.

1. Go to <https://console.firebase.google.com>, create a project (free
   "Spark" plan, no credit card).
2. **Build → Realtime Database → Create Database** → start in *test mode*.
   (Anyone with your database URL + room code could read/write it — fine
   for a private hobby link.)
3. **Project settings (gear) → General → Your apps → </> (Web app)** —
   register an app, copy the `firebaseConfig` object.
4. Open `js/firebase-config.js` in your repo, paste your values over the
   placeholders, commit.

## Step 3 — Map your track

You have two options, both in **Track Editor**:

**Option A — drive it:**
1. Open the site on your phone → Track Editor.
2. *Start driving*, drive one clean lap crossing your start line at both
   ends, *Stop & build track*.

**Option B — draw it on a map (no driving needed):**
1. Track Editor → scroll to "Or draw it on a map".
2. Switch the layer to *Satellite* (top-right control on the map), zoom in
   on your circuit.
3. Click *"Click map to add points"* to arm point-placing, then click along
   the racing line, start to finish. Undo/Clear if you misclick.
4. *Build track from these points*.

Either way you land in the same next step:

5. Click along the track outline to drop sector splits (click a marker
   again to remove it; fine-tune exact distances in the list below the
   map).
6. Name it, **Save track**.

## Step 4 — Design your dashboards

Both **Recorder** (phone) and **Overlay** (OBS) use the same editable
widget system, but with independent layouts:

1. Start a session (Recorder) or connect to a room (Overlay) to reveal the
   dashboard.
2. Tap the pencil button (bottom-right) to enter **edit mode**.
3. **Move** a widget by dragging it. **Resize** with the handle in its
   bottom-right corner. **Recolor** with the dot button on its header
   (accent color, text color, background opacity). **Remove** with the ×.
4. Tap **+** to add more widgets: Speed, Delta, Lap Time, Best Lap, Lap
   Counter, Sector Lights, Track Map, GPS Accuracy.
5. Tap the pencil again to exit edit mode. Changes save automatically —
   locally on the phone for Recorder, and through the room for Overlay.

## Step 5 — Race day

1. **Phone:** Recorder → pick the track → type a room code (e.g.
   `rally-2026`) → **Start session**. Mount with a clear sky view, keep the
   screen on.
2. **PC:** Overlay → same room code → **Connect**. In OBS: **Add Source →
   Browser** → paste the overlay URL (e.g.
   `https://yourusername.github.io/racing-overlay/overlay.html`) → size it
   to your scene — background is already transparent.
3. Drive. Speed, delta-vs-best, sector lights and the mini map update live
   in both places as you cross the start/finish and each sector.
4. Afterwards: **Analytics** (phone, or import exported laps on your PC) to
   compare laps and see speed/delta traces.

## Notes on accuracy

Phone GPS typically updates once a second at 3–10 m accuracy — good for
hobby-level delta timing and sector splits, not motorsport-grade precision.
A dedicated GPS receiver with a cleaner feed would be more accurate, but
browsers can't read serial/Bluetooth GPS hardware directly without extra
work — a natural next step if you want to push further.

## Extending it

Everything is plain HTML/CSS/JS, no build step, no framework — open any
file, edit, refresh. Natural next steps:
- Ghost-car dot on the track map showing the best lap's position alongside
  the live car.
- Ghost speed trace overlaid live against your best lap.
- Session history browser — list past sessions per track, quick-load laps.
- Web Bluetooth support for external GPS/OBD hardware.
