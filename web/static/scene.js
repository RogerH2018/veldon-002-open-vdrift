// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from "./vendor/three.module.js";

const paint = (color) => new THREE.MeshLambertMaterial({ color });
const cube = new THREE.BoxGeometry(1, 1, 1);
const vertical = new THREE.Vector3(0, 0, 1);

function box(parent, material, x, y, z, width, length, height) {
  const object = new THREE.Mesh(cube, material);
  object.position.set(x, y, z);
  object.scale.set(width, length, height);
  parent.add(object);
  return object;
}

function strip(parent, circuit, material, widths, z, choose = () => true) {
  const vertices = [];
  const { centers } = circuit;
  const edge = (i, side) => {
    const { center, right, width } = centers[i];
    const offset = widths[side](width);
    return [center.x + right.x * offset, center.y + right.y * offset, z];
  };
  centers.forEach((_, i) => {
    if (!choose(i)) return;
    const next = (i + 1) % centers.length;
    const a = edge(i, 0), b = edge(i, 1), c = edge(next, 0), d = edge(next, 1);
    vertices.push(...a, ...b, ...c, ...b, ...d, ...c);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  parent.add(new THREE.Mesh(geometry, material));
}

function roadMark(parent, material, point, offset, depth, width, length) {
  const { center, forward, right } = point;
  const x = center.x + offset * right.x + depth * forward.x;
  const y = center.y + offset * right.y + depth * forward.y;
  const mark = box(parent, material, x, y, .015, width, length, .014);
  mark.rotation.z = Math.atan2(-forward.x, forward.y);
}

function addCircuit(parent, circuit) {
  const asphalt = paint(0x3e4243);
  const shoulder = paint(0x887258);
  const cream = paint(0xcabca2);
  const orange = paint(0xad542d);
  const dark = paint(0x252925);
  strip(parent, circuit, shoulder, [w => -w - .75, w => w + .75], -.018);
  strip(parent, circuit, asphalt, [w => -w, w => w], 0);
  strip(parent, circuit, cream, [w => -w + .26, w => -w + .37], .013);
  strip(parent, circuit, cream, [w => w - .37, w => w - .26], .013);
  for (const [material, parity] of [[cream, 0], [orange, 1]]) {
    const curbs = (i) => Math.floor(i / 2) % 2 === parity &&
      ((i > 85 && i < 150) || (i > 213 && i < 260) || (i > 305 && i < 353));
    strip(parent, circuit, material, [w => -w - .69, w => -w - .08], .022, curbs);
    strip(parent, circuit, material, [w => w + .08, w => w + .69], .022, curbs);
  }
  const { width } = circuit.centers[0];
  const checkWidth = width / 7;
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 14; i += 1) {
      roadMark(parent, (i + row) % 2 ? dark : cream, circuit.centers[0],
        (i + .5) * checkWidth - width, row * .46, checkWidth, .46);
    }
  }
  for (let i = 3; i < 23; i += 4) {
    for (const side of [-1, 1]) roadMark(parent, cream, circuit.centers[i], side * 3.2, 0, 1.75, .11);
  }
}

function mountains(parent) {
  const rocks = new THREE.IcosahedronGeometry(1, 1);
  const palettes = [paint(0x876c58), paint(0x9c7960), paint(0x695d4d), paint(0xa78766)];
  for (let i = 0; i < 36; i += 1) {
    const angle = i * Math.PI / 18;
    const radius = 254 + 55 * Math.sin(i * 2.7);
    const peak = new THREE.Mesh(rocks, palettes[i % palettes.length]);
    peak.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 2);
    peak.scale.set(50 + 29 * (1 + Math.cos(i * .8)), 33 + 18 * (1 + Math.sin(i)), 14 + 13 * (1 + Math.sin(i * 2.3)));
    peak.rotation.z = i * .51;
    parent.add(peak);
  }
}

function facilities(parent, circuit) {
  const concrete = paint(0xc3ab83);
  const roof = paint(0x343b36);
  const steel = paint(0xaeb9af);
  const copper = paint(0xc97b45);
  const black = paint(0x252b29);
  const a = circuit.centers[3];
  const gate = new THREE.Group();
  gate.position.copy(a.center).addScaledVector(a.forward, 5);
  gate.rotation.z = Math.atan2(-a.forward.x, a.forward.y);
  parent.add(gate);
  for (const x of [-9.5, 9.5]) {
    box(gate, concrete, x, 0, .34, 1.38, 1.4, .73);
    box(gate, steel, x, 0, 3.1, .32, .34, 6.3);
  }
  box(gate, roof, 0, 0, 6.15, 19.6, 1.15, .83);
  box(gate, copper, 0, -.59, 6.19, 19.6, .08, .13);
  for (let i = -8; i <= 8; i += 1) box(gate, concrete, i, -.62, 5.98, .41, .08, .09);
  for (const x of [-.74, -.25, .25, .74]) box(gate, black, x, -.68, 5.77, .35, .21, .35);

  const garage = new THREE.Group();
  garage.position.copy(a.center).addScaledVector(a.forward, 25).addScaledVector(a.right, 23);
  garage.rotation.copy(gate.rotation);
  parent.add(garage);
  box(garage, concrete, 0, 0, 1.78, 10, 24, 3.55);
  box(garage, roof, 0, 0, 3.65, 11, 25, .32);
  box(garage, copper, -5.14, 0, 3.16, .3, 24.3, .34);
  for (let i = -9; i <= 9; i += 6) {
    box(garage, black, -5.07, i, 1.42, .19, 4.77, 2.7);
    for (let h = .5; h < 2.7; h += .35) box(garage, roof, -5.19, i, h, .06, 4.47, .037);
  }
  const stands = new THREE.Group();
  stands.position.copy(a.center).addScaledVector(a.forward, 24).addScaledVector(a.right, -19);
  stands.rotation.copy(gate.rotation);
  parent.add(stands);
  for (let row = 0; row < 5; row += 1) {
    box(stands, row % 2 ? steel : concrete, -row * .75, 0, row * .41 + .35, 1, 21, .50);
  }
  for (let i = 10; i < circuit.centers.length; i += 11) {
    const { center, right, width, forward } = circuit.centers[i];
    const origin = center.clone().addScaledVector(right, width + 1.5);
    const rail = box(parent, i % 2 ? steel : concrete, origin.x, origin.y, .42, .23, 6.5, .35);
    rail.rotation.z = Math.atan2(-forward.x, forward.y);
    for (const n of [-2.3, 2.3]) {
      const post = origin.clone().addScaledVector(forward, n);
      box(parent, black, post.x + right.x * .16, post.y + right.y * .16, .25, .24, .22, .5);
    }
  }
}

function scrubland(scene, circuit) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), paint(0x645b42));
  ground.position.z = -.075;
  scene.add(ground);
  const geometry = new THREE.DodecahedronGeometry(1);
  const colors = [0x5e6042, 0x806b4d, 0x81745b, 0x929074, 0x4b5c42];
  const count = 340;
  const props = new THREE.InstancedMesh(geometry, paint(0xffffff), count);
  const object = new THREE.Object3D();
  let seed = 96352;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let i = 0;
  while (i < count) {
    const x = random() * 440 - 220;
    const y = random() * 390 - 195;
    if (circuit.centers.some(({ center }) => (x - center.x) ** 2 + (y - center.y) ** 2 < 16 ** 2)) continue;
    const size = .28 + random() ** 2 * 1.9;
    object.position.set(x, y, size * .15 - .02);
    object.scale.set(size, size * (.67 + random() * .8), size * (.3 + random() * .37));
    object.rotation.set(.1, -.17, random() * Math.PI);
    object.updateMatrix();
    props.setMatrixAt(i, object.matrix);
    props.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    i += 1;
  }
  scene.add(props);
}

function loft(rings, material) {
  const vertices = [];
  const push = (a, b, c) => vertices.push(...a, ...b, ...c);
  for (let i = 0; i < rings.length - 1; i += 1) {
    const one = rings[i], two = rings[i + 1];
    for (let j = 0; j < one.length; j += 1) {
      const n = (j + 1) % one.length;
      push(one[j], two[j], one[n]);
      push(one[n], two[j], two[n]);
    }
  }
  for (let i = 1; i < rings[0].length - 1; i += 1) {
    push(rings[0][0], rings[0][i], rings[0][i + 1]);
    const end = rings.at(-1);
    push(end[0], end[i + 1], end[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function bodywork() {
  const body = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xdb7033, roughness: .46, metalness: .26, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: 0x332e2a, roughness: .28, metalness: .66, side: THREE.DoubleSide });
  const black = paint(0x262421);
  const trim = paint(0xedba78);
  const white = new THREE.MeshBasicMaterial({ color: 0xffedbf });
  const red = new THREE.MeshBasicMaterial({ color: 0xec442f });
  const ring = (y, w, base, top, inset) => [
    [-w + .12, y, base], [w - .12, y, base], [w, y, base + .10],
    [w - inset, y, top], [-w + inset, y, top], [-w, y, base + .10],
  ];
  body.add(loft([
    ring(-2.00, .84, -.14, .29, .12), ring(-1.63, .93, -.19, .37, .06),
    ring(-.76, .89, -.21, .35, .03), ring(.75, .88, -.21, .35, .04),
    ring(1.55, .89, -.16, .29, .09), ring(2.01, .77, -.10, .18, .11),
  ], shell));
  const cabin = (y, w, height, roof) => [[-w, y, .30], [w, y, .30], [roof, y, height], [-roof, y, height]];
  body.add(loft([
    cabin(-1.42, .72, .36, .63), cabin(-.70, .71, .80, .55),
    cabin(.21, .71, .84, .54), cabin(1.13, .71, .34, .61),
  ], glass));
  box(body, shell, 0, -.24, .82, 1.10, .90, .079);
  box(body, black, 0, -2.015, .039, 1.59, .07, .215);
  box(body, black, 0, 2.027, -.04, 1.46, .068, .16);
  box(body, trim, 0, -2.059, .009, .40, .02, .115);
  for (const x of [-.56, .56]) {
    box(body, white, x, 2.021, .095, .32, .038, .104);
    box(body, red, x, -2.043, .195, .41, .040, .10);
    box(body, trim, x, -2.065, .159, .28, .014, .019);
    box(body, black, x, -1.64, .427, .09, .18, .15);
    box(body, shell, x * 1.67, .62, .395, .19, .22, .061);
  }
  box(body, shell, 0, -1.69, .51, 1.77, .30, .070);
  box(body, trim, 0, 1.48, .307, .20, .68, .012).rotation.x = -.13;
  return body;
}

function makeWheel() {
  const wheel = new THREE.Group();
  const tire = new THREE.CylinderGeometry(.315, .315, .223, 19);
  tire.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(tire, paint(0x222324)));
  const rim = new THREE.CylinderGeometry(.219, .219, .228, 16);
  rim.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(rim, paint(0x6c6c62)));
  const metal = paint(0xbeada1);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const rail = box(wheel, metal, side * .118, 0, 0, .009, .341, .027);
      rail.rotation.x = i * Math.PI / 6;
    }
  }
  return wheel;
}

export function createScene(viewport, circuit) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  viewport.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcda37b);
  scene.fog = new THREE.FogExp2(0xcda37b, .004);
  const camera = new THREE.PerspectiveCamera(57, 1, .13, 550);
  camera.up.copy(vertical);
  scene.add(new THREE.HemisphereLight(0xffead0, 0xaf8e78, 2.2));
  const sun = new THREE.DirectionalLight(0xffd5ad, 2.55);
  sun.position.set(-110, 24, 69);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc1daee, .65);
  fill.position.set(52, -80, 53);
  scene.add(fill);
  scrubland(scene, circuit);
  mountains(scene);
  addCircuit(scene, circuit);
  facilities(scene, circuit);

  const blob = document.createElement("canvas");
  blob.width = blob.height = 64;
  const ctx = blob.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 11, 32, 32, 31);
  gradient.addColorStop(0, "rgba(17,15,15,.75)");
  gradient.addColorStop(1, "rgba(17,15,15,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.8),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
  scene.add(shadow);
  const car = bodywork();
  const wheels = Array.from({ length: 4 }, makeWheel);
  scene.add(car, ...wheels);

  const resize = () => {
    const { clientWidth, clientHeight } = viewport;
    camera.aspect = clientWidth / clientHeight;
    camera.fov = camera.aspect < 1 ? 71 : 57;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(clientWidth, clientHeight, false);
  };
  new ResizeObserver(resize).observe(viewport);
  resize();

  const heading = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const target = new THREE.Vector3();
  const facing = new THREE.Vector3();
  function render(state, active, elapsed, snap) {
    car.position.fromArray(state);
    car.quaternion.fromArray(state, 3);
    wheels.forEach((wheel, i) => {
      const offset = (i + 1) * 7;
      wheel.position.fromArray(state, offset);
      wheel.quaternion.fromArray(state, offset + 3);
    });
    heading.set(0, 1, 0).applyQuaternion(car.quaternion);
    heading.z = 0;
    if (heading.lengthSq() < .005) heading.set(0, 1, 0);
    heading.normalize();
    shadow.position.set(car.position.x, car.position.y, .005);
    shadow.rotation.z = Math.atan2(-heading.x, heading.y);
    if (snap) facing.copy(heading);
    facing.lerp(heading, 1 - Math.exp(-elapsed * 6)).normalize();
    lateral.set(facing.y, -facing.x, 0);
    desired.copy(car.position).addScaledVector(facing, active ? -8.7 : -6.1);
    desired.addScaledVector(lateral, active ? 0 : 4.7);
    desired.z += active ? 3.7 : 2.15;
    target.copy(car.position).addScaledVector(facing, active ? 7.4 : 1.35);
    if (!active && camera.aspect >= 1) target.addScaledVector(lateral, -3.6);
    target.z += active ? .35 : .20;
    const blend = snap ? 1 : 1 - Math.exp(-elapsed * 10);
    camera.position.lerp(desired, blend);
    look.lerp(target, blend);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  return { render };
}
