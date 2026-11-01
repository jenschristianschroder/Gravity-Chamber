# Gravity Chamber

A browser game prototype where the phone is a three-dimensional chamber. Guide an orb through six beacons using the phone's motion. Gameplay has no directional touch controls. Buttons start, pause, restart, and exit.

Plain HTML, CSS, and JavaScript. No dependencies, build step, player accounts, API keys, backend, tracking, or external assets. The personal best is stored only in the current browser's local storage. The source is ready for a static host such as GitHub Pages.

## Publish on GitHub Pages

This repository contains the game at its root, with `index.html` alongside `styles.css`, `physics.js`, and `game.js`.

1. Open the repository's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and **/ (root)**, then save.
2. Once GitHub finishes publishing, open the HTTPS address displayed in Pages settings on your phone. Enable **Enforce HTTPS** when available.
3. Tap **Enable motion & play**, allow the browser's motion permission, and hold the phone still briefly.

The GitHub Pages address for this repository is [jenschristianschroder.github.io/Gravity-Chamber/](https://jenschristianschroder.github.io/Gravity-Chamber/). It becomes available after Pages is enabled and its first deployment succeeds.

All file paths are relative, so GitHub Pages project URLs work. The empty `.nojekyll` file keeps publication static.

Official instructions: [configure a Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [HTTPS on Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Play

- **Tilt:** gravity acts in the chamber's local coordinates. The orb falls toward the physically lower side.
- **Move:** acceleration along X, Y, and Z changes the orb's relative motion. A quick sideways movement makes the orb lag behind.
- **Turn:** angular velocity and changes in angular velocity contribute rotating-frame effects on all three axes.
- **Collect:** bring the orb into the amber beacon and slow it briefly. Six corners light up in sequence, including front, back, and upper corners.

Keep hold of the phone; gentle motions are sufficient. The chamber has real depth, so bringing the orb toward the screen and sending it away from the screen both matter. Turn the phone in its plane to reach the upper corners. Automatic screen rotation adjusts the view without resetting the physical state.

The desktop **Watch the demo** button supplies synthetic movement. It is a separate demonstration, does not access sensors, and does not save a personal best.

## Physics

The simulation keeps a sphere inside six rigid walls, with dissipative collisions, contact friction, and mild damping. It advances at a fixed 120 Hz while rendering follows the display refresh rate. It does not require or promise sensor delivery at 120 Hz; it uses the latest filtered reading.

`DeviceMotionEvent.accelerationIncludingGravity` is accelerometer specific force, `f = a_origin - g`. The chamber's translational apparent acceleration is therefore `-f`, including both gravity and phone acceleration. Gravity is not added a second time.

The complete approximate acceleration in the chamber frame is:

```
a_relative = -f - 2 (omega × velocity)
                - omega × (omega × position)
                - angular_acceleration × position
```

The additional terms model Coriolis, centrifugal, and Euler acceleration. `omega` comes from the gyroscope, converted from degrees to radians per second. Its derivative is filtered to estimate angular acceleration. Inputs and speed are capped to keep the prototype playable and numerically stable. The chamber origin is treated as the sensor position; no attempt is made to model the exact sensor offset within a particular phone. This is a game simulation, not a precision physical instrument.

The current W3C/MDN `DeviceMotionEvent.rotationRate` convention maps `alpha`, `beta`, `gamma` to body-axis X, Y, Z rates. These names should not be confused with `DeviceOrientationEvent`'s Euler angles. Platform mapping and signs still need real-device verification on the target browsers.

This design never integrates phone acceleration into a real-world phone position. Such position estimates drift quickly. Moving at constant velocity produces no sustained inertial force, as expected; starting, stopping, tilting, and turning are the controls.

## Sensor behavior

- Motion access is requested directly from the Start button when `requestPermission()` exists.
- Motion needs HTTPS, a compatible browser, and finite acceleration readings on all three axes.
- A short stationary sample can remove a small gyro bias. It does not subtract gravity or redefine which direction is down.
- Unavailable gyroscope readings are disclosed in the game. Gravity and linear movement can still work, but complete rotation effects require a functioning gyroscope.
- Missing readings time out with recovery guidance. Interrupted readings and backgrounding pause the game.
- Open the page directly in the phone browser; embedded and in-app browsers may restrict sensors.

## Validation

Run the dependency-free Node tests with:

```
node --test tests/*.test.cjs
```

Sixteen automated checks cover all six wall directions, accelerometer signs, rotation-force directions, collision energy loss, numerical stability, permission denial, missing and stale sensor readings, pause/resume, and completion/replay of the six-beacon demo. HTML asset references and JavaScript syntax were also checked.

**Verification limits:** the available browser-preview service was unavailable, so visual browser QA has not been completed. No physical iPhone or Android device was available. Sensor signs, rotation-axis behavior, screen rotation, layout, and game feel require an on-device pass before calling this production-ready.

## Sources

- [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/)
- [MDN accelerationIncludingGravity](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/accelerationIncludingGravity)
- [MDN rotationRate](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/rotationRate)
- [MDN motion permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static)
- [Cambridge: An introduction to inertial navigation](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-696.html)
