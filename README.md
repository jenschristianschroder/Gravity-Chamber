# Gravity Run

A third-person motion-controlled browser game, hosted in the Gravity Chamber repository.

**[Play Gravity Run](https://jenschristianschroder.github.io/Gravity-Chamber/)**

Guide a little rolling robot across a floating skyway. Tilt, twist, and nudge your phone to manage momentum, navigate moving gates, and jump the gap. There are no accounts, third-party network requests, external libraries, or server-side logic.

## Playing

1. Open the game on a phone over HTTPS and tap **Play with motion**.
2. Allow motion access when prompted.
3. Hold the phone upright and still, with its physical top edge up, for about one second.
4. Tilt forward to accelerate; tilt back to brake or reverse.
5. Lean left or right to steer. Twist gently around the phone's vertical axis for an extra turn.
6. Move the phone briefly forward or sideways for a small impulse. Nudge upward to hop; downward to shorten a jump.

Small movements are enough. Keep hold of the phone. The robot carries momentum, so slow down before a tight turn.

**Watch a demo** runs a complete automated lap on desktop or mobile without sensor permission. It does not write a personal best.

## Skyway: course 01

A roughly 334-metre course with six sections:

- A wide opening to learn the controls.
- Two sweeping coastal bends.
- A narrow skybridge.
- Two gates with moving openings.
- An ascending ramp and a 4.5-metre gap.
- A descending spiral and finish line.

Collect 15 energy cells. Four checkpoints preserve progress after a fall, with a two-second time penalty. Best completion time is stored only in this browser's local storage.

The automated demonstration completes the course in about 66 seconds with no falls and all cells collected.

## Fullscreen and orientation

Gameplay fills the available viewport. It requests native fullscreen and portrait orientation locking where supported. The entire game surface counterrotates when the operating system changes screen orientation, keeping the game's axes aligned with the physical phone. The third-person camera follows the course with a level horizon.

On iPhone, use Safari's **Share → Add to Home Screen** and launch the new icon to play without browser bars. Browsers can decline fullscreen or orientation-lock requests; the viewport and CSS fallback remain available.

The page pauses if it loses visibility or motion samples stop arriving. Resume after fresh readings arrive, or restart to recalibrate.

## Implementation

- `run-core.js`: deterministic 120 Hz physics, procedural course, collisions, checkpoints, collectibles, and demo driver.
- `run-input.js`: upright calibration, sensor sign normalization, smoothing, tilt controls, optional gyroscope twist, and one-shot motion impulses.
- `run-renderer.js`: dependency-free WebGL scene, follow camera, robot, floating scenery, shadows, and course geometry.
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

The tests cover control direction across sensor conventions, missing sensors, bounded motion impulses, the complete course, physical obstacles and falls, camera math and rendering data, permission denial/cancellation, pause/resume, orientation fallback, and game completion.

Renderer checks use a mock WebGL API. Controller checks use a simulated DOM. These checks do not replace real WebGL rendering or physical iOS/Android testing.

Pushes to `main` trigger `.github/workflows/pages.yml`, which checks JavaScript syntax, runs the tests, assembles the static files, and deploys them to GitHub Pages. Repository Pages must use **GitHub Actions** as its source.

The previous Gravity Chamber game remains available in Git history.
