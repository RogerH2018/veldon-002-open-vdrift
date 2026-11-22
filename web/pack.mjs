// SPDX-License-Identifier: GPL-3.0-or-later
import { access, copyFile, cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const buildDir = resolve(process.argv[2] ?? join(here, "build"));
const outputDir = resolve(process.argv[3] ?? join(here, "dist"));
const threeDir = join(here, "node_modules", "three");
const files = [
  [join(buildDir, "engine.mjs"), "engine.mjs"],
  [join(buildDir, "engine.wasm"), "engine.wasm"],
  [join(buildDir, "BULLET-LICENSE.txt"), "BULLET-LICENSE.txt"],
  [join(here, "..", "LICENSE"), "LICENSE"],
  [join(threeDir, "LICENSE"), "vendor/THREE-LICENSE.txt"],
  [join(threeDir, "build", "three.module.js"), "vendor/three.module.js"],
];

await Promise.all(files.map(([source]) => access(source)));
await mkdir(join(outputDir, "vendor"), { recursive: true });
await cp(join(here, "static"), outputDir, { recursive: true });
await Promise.all(files.map(([source, target]) => copyFile(source, join(outputDir, target))));
console.log(outputDir);
