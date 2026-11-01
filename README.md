# Gravity Run

A third-person motion-controlled browser game, hosted in the Gravity Chamber repository.

**[Play Gravity Run](https://jenschristianschroder.github.io/Gravity-Chamber/)**

Guide a little rolling robot across six floating courses. Tilt, twist, and nudge your phone to manage momentum, navigate moving gates, and jump the gaps. There are no accounts, third-party network requests, external libraries, or server-side logic.

## Playing

1. Open the game on a phone over HTTPS and tap **Play with motion**.
2. Allow motion access when prompted.
3. Hold the phone upright and still, with its physical top edge up, for about one second.
4. Tilt forward to accelerate; tilt back to brake or reverse.
5. Lean left or right to steer. Twist gently around the phone's vertical axis for an extra turn.
6. Move the phone briefly forward or sideways for a small impulse. Nudge upward to hop; downward to shorten a jump.

Small movements are enough. Keep hold of the phone. The robot carries momentum, so slow down before a tight turn.

Use **Change track** to choose a course. **Watch a demo** (or **Preview this track** for a locked course) runs a complete automated lap without sensor permission. Demos do not write personal bests or unlock tracks.

## Six-track campaign

Finish each course with motion controls to unlock the next. Every course has a distinct route and sky palette. Later courses have narrower bridges, tighter turns, faster gates with smaller openings, more jumps, and fewer checkpoints.

| Track | Difficulty | Length | Gates | Jumps | Checkpoints, including start |
| --- | --- | ---: | ---: | ---: | ---: |
| 01 Skyway | Easy | 334 m | 2 | 1 | 4 |
| 02 Seabreeze | Steady | 395 m | 3 | 1 | 4 |
| 03 Switchback | Tricky | 375 m | 3 | 2 | 4 |
| 04 Cloudspire | Hard | 454 m | 4 | 2 | 3 |
| 05 Fracture | Expert | 491 m | 5 | 3 | 3 |
| 06 Eventide | Master | 589 m | 6 | 4 | 2 |

Skyway teaches the basics. Seabreeze adds long coastal bridges; Switchback introduces hairpins and a second jump. Cloudspire climbs a corkscrew, Fracture crosses separated islands, and Eventide combines the hardest obstacles into the final gauntlet.

Collect energy cells along the way. Checkpoints preserve progress after a fall, with a two-second time penalty. Unlocks, the selected course, and separate best times are stored only in this browser. Existing Skyway records migrate automatically and unlock Seabreeze. If storage is blocked, progress still works for the current session.

Automated demos complete all six routes without falling, in roughly 66–120 seconds. These timings establish that the routes are traversable; a player's pace will depend on motion control and recovery time.

## Sound and feedback

The speaker button switches sound on or off and remembers the preference on this device. Sound starts after a tap. A quiet rolling texture follows speed; jumps, landings, gate impacts, energy cells, checkpoints, falls, recovery, and finishing have distinct cues. Pausing or hiding the page silences playback.

All sounds are synthesized with the Web Audio API, with a master limiter and bounded simultaneous effects. There are no audio downloads. If audio is unavailable or blocked, the game remains playable.

Pickup sparks, checkpoint bursts, a finish celebration, gentle landing animation, and colored toast messages make events easier to recognize. Coral chevrons identify the takeoff area before every gap. Decorative particles, body deformation, and speed-related camera zoom respect reduced-motion preferences.

Contact shadows soften as the robot rises, follow the slope of the track, and disappear over gaps, outside the track, or when the robot drops below the surface. Recovery cuts the camera back to the checkpoint.

## Fullscreen and orientation

Gameplay fills the available viewport. It requests native fullscreen and portrait orientation locking where supported. The entire game surface counterrotates when the operating system changes screen orientation, keeping the game's axes aligned with the physical phone. The third-person camera follows the course with a level horizon.

On iPhone, use Safari's **Share → Add to Home Screen** and launch the new icon to play without browser bars. Browsers can decline fullscreen or orientation-lock requests; the viewport and CSS fallback remain available.

The page pauses if it loses visibility or motion samples stop arriving. Resume after fresh readings arrive, or restart to recalibrate.

## Implementation

- `run-core.js`: deterministic 120 Hz physics, six course definitions, collisions, checkpoints, collectibles, and demo driver.
- `run-progress.js`: campaign unlocks, per-track records, storage validation, and legacy record migration.
- `run-input.js`: upright calibration, sensor sign normalization, smoothing, tilt controls, optional gyroscope twist, and one-shot motion impulses.
- `run-audio.js`: gesture-activated sound synthesis, rolling texture, bounded effect voices, mute persistence, and pause cleanup.
- `run-renderer.js`: dependency-free WebGL scene, follow camera, robot, floating scenery, height-aware contact shadows, visual effects, and course geometry.
- `game.js`: permissions, game state, fullscreen/orientation handling, HUD, and local records.
- `index.html` / `styles.css`: responsive menu and game interface.

Phone movement controls simulated forces and impulses. It does not attempt to reconstruct absolute physical position by integrating noisy accelerometer readings. Gravity, track slope, inertia, drag, collisions, and jumping are simulated in the course's world coordinates.

Calibration accommodates opposite accelerometer sign conventions. Tilt works when gyroscope data is unavailable; translation impulses also have a gravity-filter fallback when the browser does not expose linear acceleration separately. WebGL and device-motion availability depend on the browser and device.

No build step or package installation is required. Serve this directory with any static HTTP server; actual phone motion access requires a secure context.

## Tests and deployment

Run the automated tests with Node.js:

~~~sh
node --test tests/*.test.cjs
~~~

The tests cover control direction across sensor conventions, missing sensors, bounded motion impulses, completion of every course, increasing difficulty, obstacles and falls, camera math and rendering data, renderer resource cleanup when switching courses, permission denial/cancellation, pause/resume, orientation fallback, the complete campaign flow, locked previews, migration, and persistence. Regression checks cover shadows below the track, gaps, edges and ramps, discrete event delivery, reduced-motion effects, sound scheduling, voice limits, mute persistence, and silencing on pause or page hiding.

Renderer and audio checks use mock WebGL and Web Audio APIs. Controller checks use a simulated DOM. These checks do not replace real rendering, listening, or physical iOS/Android testing.

Pushes to `main` trigger `.github/workflows/pages.yml`, which checks JavaScript syntax, runs the tests, assembles the static files, and deploys them to GitHub Pages. Repository Pages must use **GitHub Actions** as its source.

The previous Gravity Chamber game remains available in Git history.
