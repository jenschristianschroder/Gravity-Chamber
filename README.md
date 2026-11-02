# Gravity Run

A third-person browser game where your phone is the controller.

**[Play Gravity Run](https://jenschristianschroder.github.io/Gravity-Chamber/)**

Guide a rolling robot across six floating courses. Learn to roll, brake, steer, and hop; then find faster lines, earn medals, race your own ghost, and challenge friends. The game runs entirely in the browser. No accounts, backend, external libraries, tracking, advertising, or third-party runtime requests. There are no touch, keyboard, or joystick movement controls.

## Playing and learning

Open the HTTPS link on a phone and choose **Learn & play**. Allow motion access when prompted. Hold the phone comfortably, with its top edge up, and keep still while the calibration bar fills. Flight school gives you four short, interactive goals: roll to a marker, stop, steer both ways, and hop across a gap. You can skip it or revisit it in Settings.

Tilt the top edge away to accelerate, toward you to brake or reverse, and lean sideways to steer. Briefly lift the whole phone to hop; a downward nudge shortens airtime. Small movements are enough. Keep hold of the phone.

Settings offers Gentle, Balanced, or Responsive sensitivity. A neutral dead zone reduces small accidental inputs. Optional **Twist boosts & directional nudges** enables additional steering and forward/sideways impulses. Hopping always works. Twist uses device-motion gamma, rotation about the phone’s upright Y axis. Tilt still works without gyroscope data.

A new run reuses a recent calibration after a fresh sensor reading and a short ready pause. **Recenter my phone** in the pause menu changes the neutral angle without resetting your current attempt. Lost motion readings, hiding the page, or a long frame interruption pauses play. Brief jump buffering and edge grace make hops less brittle; side nudges have their own cooldown.

**How to move** has six animated SVG lessons, each showing the phone movement beside the robot’s response. Animations can be paused or scrubbed, work without WebGL or sensor access, and respect reduced-motion settings. The entire robot leans with calibrated phone input; the follow camera keeps a level horizon.

## Campaign and mastery

Finish a campaign course with motion controls to unlock the next. Normal play has frequent safe checkpoints. **Expert checkpoints** retains the original sparse recovery points and has separate records. Each fall adds two seconds.

| Course | Difficulty | Length | Gates | Gaps | Normal / expert checkpoints |
| --- | --- | ---: | ---: | ---: | ---: |
| Skyway | Easy | 334 m | 2 | 1 | 8 / 4 |
| Seabreeze | Steady | 395 m | 3 | 1 | 11 / 4 |
| Switchback | Tricky | 375 m | 3 | 2 | 10 / 4 |
| Cloudspire | Hard | 454 m | 4 | 2 | 11 / 3 |
| Fracture | Expert | 491 m | 5 | 3 | 12 / 3 |
| Eventide | Master | 589 m | 6 | 4 | 13 / 2 |

Moving gates start at half Skyway's original speed. Their sideways speed rises gradually across the six courses, accounting for different sweep widths, and the animation rate never exceeds the original Skyway rate. Practice, daily flights, and friend challenges inherit their source course's gate timing.

Seabreeze and Fracture offer narrower gold-edged shortcuts with collectible detours. Later courses have gently banked turns. A moving platform in Fracture’s island chain provides an optional intermediate landing. Its rendered position and collision surface use the same animation.

Earn Bronze, Silver, and Gold time medals, plus independent clean-run and all-cells badges. Your best medal contributes 1–3 mastery marks; each badge contributes one more. Campaign marks unlock Coral, Mint, Sky, and Gold courier colors without changing the physics. Results suggest a next goal and show the difference from your best time.

A translucent, non-colliding ghost replays your fastest local attempt. Checkpoint splits show time gained or lost. Ghosts are bounded in storage and disabled with reduced motion or the ghost setting. Recovery jumps are not interpolated across the course.

**Practise a section** opens any of the current course’s six sections with separate, unscored attempts. After repeated falls in a section, the HUD offers a direct practice shortcut. Demos and practice do not save personal records or unlock the campaign. Demos can preview locked courses.

The initial campaign medal thresholds (Gold / Silver / Bronze, seconds) are 74/95/125, 92/118/150, 84/110/145, 103/132/170, 114/148/185, and 136/174/220. Short-course targets scale with length and obstacles. These are provisional targets, to be tuned through real phone playtests.

## Daily flights and friends

- **Daily flight:** a deterministic short course shared by everyone, changing at 00:00 UTC. Replay the last seven days from the archive. The schedule cycles through 24 curated course/section combinations; it does not generate untested random geometry.
- **Quick challenges:** six short routes, available without campaign unlocks, with separate local bests.
- **Challenge a friend:** a finish-screen link includes the course, section, rules version, checkpoint mode, and target time. The receiver can play immediately even if their campaign has not reached that course. Beating it produces a rematch link.
- **Result cards:** create a PNG on-device. Use the native share sheet where available, or copy the link and save the card. Sharing only happens after the player chooses it. Link previews use a static social image; individual scores live in the link fragment and result card.
- **Pass the phone:** two named players take three attempts each on the same daily course. Recalibrate for each player; the fastest attempt wins. These results never overwrite personal records.

All competition is friendly and unverified. No global leaderboard or remote multiplayer service is involved. Shared challenge and daily records remain separate from campaign progression.

## Saving, installation, and updates

Progress and settings stay in this browser. **Export my progress** saves a JSON backup. **Import a backup** merges achievements and keeps the fastest times, while retaining current settings. Moving between browsers/devices requires that backup; there is no automatic cloud sync.

Version 1 campaign times remain visible as **Previous rules** and keep their unlocks. Version 2 times and ghosts are tracked separately because the controls, checkpoints, and routes changed. Imports validate record types, ranges, rules versions, dates, and ghost sizes before applying changes. If storage is unavailable, the game remains playable with session-only progress. If storage fills, saving retries without optional ghosts. Very large backups omit ghosts so the exported file always fits the import limit; achievements and times are retained.

After the first online visit finishes caching, the full game is playable offline. Settings confirms when it is ready. Supported browsers offer installation; on iPhone use Safari → Share → Add to Home Screen. Appropriate normal, maskable, and Apple icons are included.

A service worker installs the complete application shell before offering an update. It does not automatically replace an active run. When an update is waiting, Settings offers **Update & reload**. Each release must change both the worker cache name and the asset query version. Browser storage eviction or clearing site data removes offline files and local progress.

Gameplay requests fullscreen, portrait locking, and a screen wake lock where supported. The viewport counterrotates when native orientation locking is unavailable, keeping controls aligned with the physical phone. Wake locks release on pause, finish, or hiding the page. Optional browser feature failures do not prevent play.

## Presentation and performance

Outside the course, a native-style app shell uses four destinations: Play, Worlds, Challenges, and Courier. Phone screens fill the viewport, with safe-area spacing, persistent navigation on the main destinations, fixed screen headers, independently scrolling content, and large controls. Secondary screens have a consistent back action.

The little robot is the recurring identity on the home screen, every menu, calibration, pause, and results. Shared SVG artwork stays sharp and reflects the selected courier color, including a live preview in Courier. Small character animations and screen transitions respect reduced motion. App artwork is hidden during gameplay, and the 3D renderer stops drawing while the app screens cover it. Resuming or starting a run cuts the camera directly to the robot.

The ceramic courier has a fitted visor, casing details, side pivots, an underside drive ring, and a lit rear battery panel. Track slabs have joints, edge lighting, maintenance hardware, exposed ends, and braces. Floating islands have layered rock, foliage, trees, and hanging vegetation. Lighting distinguishes ceramic, metal, and illuminated materials.

All sound is synthesized with Web Audio after a user gesture: rolling, hopping, landing, collisions, cells, checkpoints, recovery, and completion. A remembered mute setting, master limiter, and bounded voices keep playback controllable. Sound pauses when play pauses.

Takeoff chevrons, landing rings, hop readiness, speed hints, checkpoint feedback, and distinct sounds help explain what happened. Contact shadows follow slope and banking, clip to track/platform edges, and disappear below surfaces and over unsupported gaps.

Geometry is generated locally, batched, and culled beyond the fog distance. Course changes release old scene buffers. Tests enforce a 12 MiB geometry budget, fewer than 80 ordinary gameplay draw calls, and fewer than 100,000 visible triangles at sampled campaign positions. Auto quality adapts pixel resolution after sustained frame pressure; Battery saver, Balanced, and High detail are also available. These budgets are not measured phone frame rates.

Physics runs at 120 Hz. All accepted active frame time is simulated, with scoring at the exact physics step that reaches the finish. Frames longer than 250 ms pause instead of discarding time from the score. Long background periods and sensor loss also pause. Sensor movement applies simulated forces and impulses; the game does not try to reconstruct absolute phone position by double-integrating acceleration.

## Source and checks

- `run-core.js`: course geometry, forces, collision, recovery, and demo driving.
- `run-input.js`: stable calibration, sensor normalization, filtering, and gestures.
- `run-journey.js`: training, short-course slicing, challenge links, medals, ghosts, and quality policy.
- `run-progress.js`: local records, progression, migration, backups, and validation.
- `run-share.js`: time formatting, result cards, download, and wake locks.
- `run-renderer.js`: WebGL geometry, lighting, camera, robot pose, shadows, and effects.
- `run-audio.js` / `run-guide.js`: synthesized audio and animated movement lessons.
- `game.js`: menus, activities, permissions, run states, scoring, and browser integrations.
- `index.html` / `styles.css` / `app-shell.css`: shared robot artwork, native-style app screens, course HUD, and accessible navigation.
- `sw.js` / `manifest.webmanifest`: offline releases and installation.

No package installation or build tool is required. Run checks with Node.js:

```sh
node --test tests/*.test.cjs
```

Tests cover the campaign, all 36 possible short-course slices and 36 practice slices, tutorial goals, calibration, gesture axes/cooldowns, buffered hops, moving-platform support, records and backups, ghosts, challenge validation, pass-the-phone turns, retry/recenter states, slow-frame scoring, sharing fallback, wake-lock races, offline cache routing, rendering budgets, shadows, sound, and the animated guide.

Controller tests use a simulated DOM; WebGL and audio tests use mocks. The actual geometry, shaders, transforms, and draw calls were also rendered in an offscreen OpenGL ES 2.0 context and visually inspected, including the new branches, banked turns, platform, ghost, and training deck. None of these substitutes for physical iOS/Android sensor tests, real-device performance measurements, or human difficulty/retention testing. There is no remote analytics collection.

Pushes to `main` trigger `.github/workflows/pages.yml`: syntax checks, tests, static packaging, then GitHub Pages deployment. Pages must use **GitHub Actions** as its source. The previous Gravity Chamber game remains in Git history.
