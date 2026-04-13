import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Strike {
  id: number;
  points: THREE.Vector3[];
  life: number;
}

let strikeId = 0;

function createStrike(): Strike {
  const dir = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize();

  const start = dir.clone().multiplyScalar(3.5);
  const end = dir.clone().multiplyScalar(2.0);

  const segments = 10;
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    point.x += (Math.random() - 0.5) * 0.25;
    point.y += (Math.random() - 0.5) * 0.25;
    point.z += (Math.random() - 0.5) * 0.25;
    points.push(point);
  }

  return { id: strikeId++, points, life: 1.0 };
}

function StrikeLine({ strike }: { strike: Strike }) {
  const ref = useRef<THREE.Line>(null);
  const geometry = useRef(new THREE.BufferGeometry().setFromPoints(strike.points)).current;

  return (
    <primitive object={new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xFFD60A,
        transparent: true,
        opacity: Math.min(strike.life * 1.5, 1),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )} />
  );
}

export function LightningStrikes() {
  const [strikes, setStrikes] = useState<Strike[]>([]);

  useFrame(() => {
    // Spawn
    if (Math.random() < 0.03) {
      setStrikes(prev => {
        if (prev.length >= 8) return prev;
        return [...prev, createStrike()];
      });
    }

    // Update
    setStrikes(prev =>
      prev
        .map(s => {
          // Deflection on impact
          if (s.life < 0.7) {
            s.points.forEach(p => p.multiplyScalar(1.015));
          }
          return { ...s, life: s.life - 0.04 };
        })
        .filter(s => s.life > 0)
    );
  });

  return (
    <group>
      {strikes.map(s => (
        <StrikeLine key={s.id} strike={s} />
      ))}
    </group>
  );
}
