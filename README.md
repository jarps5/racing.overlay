# Racing Overlay

A free, browser-only racing telemetry overlay: map a track with your phone's
GPS, record laps with live speed/delta/sector timing, and stream it into OBS.
No app installs, no paid backend.

## How it fits together

- **Track Editor** (phone or PC) — drive one lap to auto-map the track line,
  then click along it to drop sector splits.
- **Recorder** (phone, in the car) — live speed/delta/lap timer, saves every
  lap to the phone's local storage, and streams the current instant to...
- **Overlay** (PC, as an OBS Browser Source) — transparent widgets: speed,
  delta bar, sector lights, mini track map with a moving car dot.
- **Analytics** (any device) — compare laps, speed-vs-distance and
  delta-vs-distance charts, export/import laps as JSON.

Tracks and laps are stored **locally on whichever device recorded them**
(browser IndexedDB) — nothing is uploaded anywhere except the live instant-by-
instant packet used to draw the overlay, which passes through Firebase and
isn't kept.

## 1. Put it on GitHub Pages (free hosting)

1. Create a new GitHub repo, e.g. `racing-overlay`.
2. Upload every file in this folder, keeping the folder structure
   (`index.html`, `css/`, `js/` all at the repo root).
3. In the repo: **Settings → Pages → Build and deployment → Deploy from a
   branch → main → / (root)**. Save.
4. GitHub gives you a URL like `https://yourname.github.io/racing-overlay/`.
   Open it on your phone and your PC.

## 2. Wire up the live link (Firebase, free)

This is only needed for the *live* phone → OBS link. Track mapping,
recording, and analytics all work without it.

1. Go to <https://console.firebase.google.com>, create a project (free
   "Spark" plan, no credit card).
2. **Build → Realtime Database → Create Database** → start in *test mode*.
   (Test mode means anyone with your database URL and room code could read/
   write it — fine for a private hobby link. Lock it down with proper rules
   if that ever matters to you.)
3. **Project settings (gear icon) → General → Your apps → </> (Web app)** —
   register an app, copy the `firebaseConfig` object it shows you.
4. Open `js/firebase-config.js` in your repo and paste your values in place
   of the placeholders. Commit.

## 3. Using it on race day

1. **On your phone**, open the site → **Track Editor** → *Start driving* →
   drive one clean lap → *Stop & build track* → click along the outline to
   add sector splits → name it → **Save track**.
2. Still on the phone, open **Recorder** → pick the track → type a room
   code (anything, e.g. `rally-2026`) → **Start session**. Mount the phone
   with a clear sky view and keep the screen on.
3. **On your PC**, open **Overlay**, enter the *same* room code, **Connect**.
   In OBS: **Add Source → Browser** → paste the overlay page URL (e.g.
   `https://yourname.github.io/racing-overlay/overlay.html`) → size it
   roughly 1000×600 → the background is already transparent.
4. Drive. Speed, delta-vs-best-lap, sector lights and the mini map update
   live on the overlay as you cross the start/finish and each sector.
5. Afterwards, open **Analytics** on the phone (or export laps as JSON and
   import them on your PC) to compare laps and see speed/delta traces.

## Notes on accuracy

Phone GPS typically updates once a second at 3–10 m accuracy — good enough
for hobby-level delta timing and sector splits, but don't expect
motorsport-grade precision. A dedicated GPS receiver with a cleaner NMEA
feed would be more accurate, but isn't supported yet since browsers can't
read serial/Bluetooth GPS hardware directly without extra work.

## Extending it

Everything is plain HTML/CSS/JS, no build step, no framework — open any file
and edit it directly, refresh the page to see changes. A few natural next
steps if you want to keep going:
- Ghost-car overlay: draw the best lap's position on the map alongside the
  live car dot (you already have both, they just need placing on the canvas
  frame each tick).
- Session history view: list past sessions per track with quick "load these
  laps" shortcuts.
- Web Bluetooth support for external GPS/OBD hardware, if you get one.
