// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from "./vendor/three.module.js";

const anchors = [
  [-71, -64], [10, -71], [91, -65], [130, -23], [120, 35],
  [76, 52], [33, 29], [-4, 42], [-43, 92], [-101, 94],
  [-135, 55], [-120, -2],
];

export function makeCircuit() {
  const spline = new THREE.CatmullRomCurve3(
    anchors.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal",
  );
  const segments = 384;
  const guide = spline.getSpacedPoints(segments).slice(0, -1);
  const centers = guide.map((center, i) => {
    const before = guide[(i + segments - 1) % segments];
    const after = guide[(i + 1) % segments];
    const forward = after.clone().sub(before).normalize();
    const right = new THREE.Vector3(forward.y, -forward.x, 0);
    return { center, forward, right, width: 7.25 + .75 * Math.cos(i * Math.PI * 4 / segments) };
  });
  const edges = new Float32Array(segments * 4);
  centers.forEach(({ center, right, width }, i) => {
    const leftEdge = center.clone().addScaledVector(right, -width);
    const rightEdge = center.clone().addScaledVector(right, width);
    edges.set([leftEdge.x, leftEdge.y, rightEdge.x, rightEdge.y], i * 4);
  });
  return { centers, edges };
}

export function createMinimap(canvas, circuit) {
  const ctx = canvas.getContext("2d");
  const background = document.createElement("canvas");
  const { width, height } = canvas;
  background.width = width;
  background.height = height;
  const base = background.getContext("2d");
  const points = circuit.centers.map(({ center }) => center);
  const minX = Math.min(...points.map(({ x }) => x));
  const maxX = Math.max(...points.map(({ x }) => x));
  const minY = Math.min(...points.map(({ y }) => y));
  const maxY = Math.max(...points.map(({ y }) => y));
  const scale = Math.min((width - 21) / (maxX - minX), (height - 17) / (maxY - minY));
  const mapX = (x) => (x - (maxX + minX) / 2) * scale + width / 2;
  const mapY = (y) => height / 2 - (y - (maxY + minY) / 2) * scale;
  base.lineJoin = "round";
  base.beginPath();
  points.forEach(({ x, y }, i) => {
    if (i === 0) base.moveTo(mapX(x), mapY(y));
    else base.lineTo(mapX(x), mapY(y));
  });
  base.closePath();
  base.strokeStyle = "#736d5f";
  base.lineWidth = 4;
  base.stroke();
  base.fillStyle = "#f5e7ce";
  base.fillRect(mapX(points[0].x) - 1, mapY(points[0].y) - 4, 2, 8);

  return (x, y) => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(background, 0, 0);
    ctx.beginPath();
    ctx.arc(mapX(x), mapY(y), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb768";
    ctx.fill();
  };
}
