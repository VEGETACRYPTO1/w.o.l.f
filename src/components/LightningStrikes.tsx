import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface Strike {
  dir: THREE.Vector3;
  start: THREE.Vector3;
  hit: THREE.Vector3;
  points: THREE.Vector3[];
  life: number;
  phase: "incoming" | "deflect";
  line: THREE.Line | null;
}

function createBolt(start: THREE.Vector3, end: THREE.Vector3, segments: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const noise = 0.06;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(start, end, t);
    p.x += (Math.random() - 0.5) * noise;
    p.y += (Math.random() - 0.5) * noise;
    p.z += (Math.random() - 0.5) * noise;
    pts.push(p);
  }
  return pts;
}

function createStrike(): Strike {
  const dir = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize();

  const start = dir.clone().multiplyScalar(4);
  const hit = dir.clone().multiplyScalar(2.02);

  return {
    dir,
    start,
    hit,
    points: createBolt(start, hit, 6),
    life: 1.0,
    phase: "incoming",
    line: null,
  };
}

export function LightningStrikes() {
  const { scene } = useThree();
  const strikes = useRef<Strike[]>([]);

  useFrame(() => {
    // Spawn
    if (Math.random() < 0.03 && strikes.current.length < 8) {
      strikes.current.push(createStrike());
    }

    // Update
    for (let i = strikes.current.length - 1; i >= 0; i--) {
      const s = strikes.current[i];

      // Deflection phase
      if (s.phase === "incoming" && s.life < 0.6) {
        s.phase = "deflect";

        const tangent = new THREE.Vector3()
          .crossVectors(s.dir, new THREE.Vector3(0, 1, 0))
          .normalize();

        const arcPoints: THREE.Vector3[] = [];
        for (let j = 0; j < 8; j++) {
          const offset = tangent.clone().multiplyScalar(j * 0.2);
          const p = s.hit.clone().add(offset).normalize().multiplyScalar(2.02);
          arcPoints.push(p);
        }
        s.points = arcPoints;
      }

      // Remove old line
      if (s.line) {
        scene.remove(s.line);
        s.line.geometry.dispose();
        (s.line.material as THREE.Material).dispose();
        s.line = null;
      }

      s.life -= 0.07;

      if (s.life <= 0) {
        strikes.current.splice(i, 1);
        continue;
      }

      // Create new line
      const geo = new THREE.BufferGeometry().setFromPoints(s.points);
      const mat = new THREE.LineBasicMaterial({
        color: 0xFFD60A,
        transparent: true,
        opacity: Math.min(s.life * 1.5, 1),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      s.line = line;
    }
  });

  // Cleanup on unmount
  useFrame(() => {}, -1); // noop, cleanup below
  return null;
}
