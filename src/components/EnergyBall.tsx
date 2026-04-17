import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSpeakingIntensity } from "@/lib/brainEvents";
import { useWake } from "@/contexts/WakeContext";

const GOLD = "#FFD36B";
const GOLD_HI = "#FFE9A8";

interface BurstParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

function Orb() {
  const { phase } = useWake();
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Burst particle pool
  const particles = useRef<BurstParticle[]>([]);
  const burstTriggeredRef = useRef(false);
  const positionsArr = useMemo(() => new Float32Array(80 * 3), []);
  const particleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positionsArr, 3));
    return g;
  }, [positionsArr]);

  // Trigger burst when entering "waking"
  useEffect(() => {
    if (phase === "waking" && !burstTriggeredRef.current) {
      burstTriggeredRef.current = true;
      const arr: BurstParticle[] = [];
      for (let i = 0; i < 80; i++) {
        const dir = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();
        const speed = 1.2 + Math.random() * 1.8;
        arr.push({
          pos: new THREE.Vector3(0, 0, 0),
          vel: dir.multiplyScalar(speed),
          life: 1,
        });
      }
      particles.current = arr;
    }
    if (phase === "sleeping") {
      burstTriggeredRef.current = false;
      particles.current = [];
    }
  }, [phase]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = performance.now() / 1000;
    const audio = getSpeakingIntensity();

    // Breathing — same rhythm as brain nodes
    const breath = 1 + Math.sin(t * 0.7) * 0.18 + audio * 0.25;
    const rot = t * 0.35;

    if (groupRef.current) {
      groupRef.current.rotation.y = rot;
      groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.15;
    }

    // Phase-driven scale/opacity
    let baseScale = 1;
    let opacity = 1;
    if (phase === "waking") {
      // quick flash then shrink+fade
      const elapsed = (performance.now() % 100000) / 1000;
      baseScale = 1 + Math.min(0.6, audio + 0.4);
      opacity = Math.max(0, 1 - (burstTriggeredRef.current ? 1 : 0) * 0.5);
    }

    if (coreRef.current) {
      coreRef.current.scale.setScalar(0.18 * breath * baseScale);
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.95 * opacity;
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(0.45 * breath * baseScale * (1 + audio * 0.4));
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.25 + audio * 0.35) * opacity;
    }

    // Update burst particles
    if (particles.current.length > 0) {
      const arr = positionsArr;
      for (let i = 0; i < 80; i++) {
        const p = particles.current[i];
        if (!p) {
          arr[i * 3] = 0; arr[i * 3 + 1] = 0; arr[i * 3 + 2] = 0;
          continue;
        }
        p.pos.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(0.96);
        p.life -= dt * 1.1;
        arr[i * 3] = p.pos.x;
        arr[i * 3 + 1] = p.pos.y;
        arr[i * 3 + 2] = p.pos.z;
      }
      const posAttr = particleGeom.getAttribute("position") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      if (particlesRef.current) {
        const m = particlesRef.current.material as THREE.PointsMaterial;
        const avgLife = particles.current.reduce((a, p) => a + (p?.life ?? 0), 0) / 80;
        m.opacity = Math.max(0, avgLife);
      }
    } else if (particlesRef.current) {
      const m = particlesRef.current.material as THREE.PointsMaterial;
      m.opacity = 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color={GOLD_HI}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Burst particles */}
      <points ref={particlesRef} geometry={particleGeom}>
        <pointsMaterial
          color={GOLD}
          size={0.06}
          transparent
          opacity={0}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export function EnergyBall() {
  const { phase } = useWake();
  // Fade the whole canvas during waking
  const fadeOut = phase === "waking";
  return (
    <div
      className="fixed inset-0 transition-opacity duration-700"
      style={{
        zIndex: 50,
        background: "#050507",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      >
        <Orb />
      </Canvas>
    </div>
  );
}
