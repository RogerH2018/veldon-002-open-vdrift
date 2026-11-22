# VDrift Web · Copperline Circuit

[Play the browser trial](https://rogerh2018.github.io/veldon-002-open-vdrift/) · [Original VDrift](https://github.com/VDrift/vdrift)

Veldon Game's 002-open is a browser trial built around VDrift's C++ vehicle dynamics. The WebAssembly build runs VDrift's engine, transmission, suspension, and tire model with Bullet collision physics. The browser renders an original rear-wheel-drive coupe and circuit with Three.js.

Drive with WASD or the arrow keys, use Space for the handbrake, and press R to restart. Touch controls appear on touch devices. Follow the circuit through all checkpoints to record a lap. Sliding on asphalt with speed earns drift points. The browser stores your best lap locally.

## Build and serve

Use an activated Emscripten SDK (tested with **4.0.23**), CMake 3.24 or newer, Ninja, Node.js, and npm. From the repository root, run these commands in an Emscripten shell.

```sh
emcmake cmake -S web -B web/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build web/build --parallel
npm ci --prefix web
node web/pack.mjs
python -m http.server 8000 --directory web/dist
```

Visit `http://localhost:8000/`. CMake fetches Bullet 3.25 at a pinned revision. To build against a local copy at that revision, pass `-DFETCHCONTENT_SOURCE_DIR_BULLET=/path/to/bullet3` to CMake. The pack command creates a static deployment directory for GitHub Pages.

## Credits and licensing

- VDrift is by Joe Venzon and the [VDrift contributors](../docs/Authors_and_contributors.md). This fork uses upstream revision `f4767dd0`.
- The browser source, coupe, circuit, and synthesized audio are original Veldon Game additions under [GPL-3.0-or-later](../LICENSE). The changes added on 2026-11-22 let the browser supply a tire configuration and use Bullet circuit geometry.
- Bullet 3.25 is distributed under its [zlib license](https://github.com/bulletphysics/bullet3/blob/2c204c49e56ed15ec5fcfa71d199ab6d6570b3f5/LICENSE.txt). Three.js 0.160.1 is distributed under its [MIT license](https://github.com/mrdoob/three.js/blob/r160/LICENSE). Both notices are included in the playable build.
