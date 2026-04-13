import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const ICON_SYMBOLS = ["⚡", "🎯", "🔥", "💎", "🚀", "⚔️", "🛡️", "🧠"];

interface FloatingIcon {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  id: number;
  phase: number;
}

function createIconTexture(symbol: string, color: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.font = "40px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function FloatingIcons({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);

  const icons = useMemo<FloatingIcon[]>(() => {
    return ICON_SYMBOLS.map((_, i) => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 2.5 + Math.random() * 1.5;
      return {
        id: i,
        phase: Math.random() * Math.PI * 2,
        position: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
      };
    });
  }, []);

  const textures = useMemo(() => {
    return ICON_SYMBOLS.map((s) => createIconTexture(s, color));
  }, []);

  useFrame(() => {
    const sphereRadius = 2.0;
    const minDistance = 2.3;
    const maxDistance = 5;
    const now = Date.now();

    icons.forEach((icon, i) => {
      const v = icon.velocity;
      const pos = icon.position;

      // Random drift
      v.x += (Math.random() - 0.5) * 0.002;
      v.y += (Math.random() - 0.5) * 0.002;
      v.z += (Math.random() - 0.5) * 0.002;

      // Limit speed
      v.clampLength(0, 0.03);

      // Move
      pos.add(v);

      // Float feel
      pos.y += Math.sin(now * 0.001 + icon.id) * 0.0008;

      // Sphere collision
      const dist = pos.length();
      if (dist < minDistance) {
        const normal = pos.clone().normalize();
        pos.copy(normal.multiplyScalar(minDistance));
        const dot = v.dot(normal);
        v.sub(normal.clone().multiplyScalar(2 * dot));
        v.multiplyScalar(0.8);
      }

      // Outer bound pull
      if (dist > maxDistance) {
        const pull = pos.clone().normalize().multiplyScalar(-0.01);
        v.add(pull);
      }

      // Update mesh
      const mesh = meshRefs.current[i];
      if (mesh) {
        mesh.position.copy(pos);
        mesh.rotation.y += 0.01;
        mesh.scale.setScalar(1 + Math.sin(now * 0.002 + icon.phase) * 0.05);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {icons.map((icon, i) => (
        <mesh
          key={icon.id}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          position={icon.position}
        >
          <planeGeometry args={[0.25, 0.25]} />
          <meshBasicMaterial
            map={textures[i]}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
