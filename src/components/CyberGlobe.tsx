import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";

const modeColors: Record<string, string> = {
  war: "#e04040",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

function GlobeWireframe({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 0.8) * 0.06;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.08;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
      meshRef.current.scale.setScalar(breathe);
    }
    if (glowRef.current) {
      glowRef.current.rotation.y = -t * 0.05;
      glowRef.current.scale.setScalar(breathe * 1.02);
    }
  });

  return (
    <group>
      {/* Main wireframe globe */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 32, 24]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.25} />
      </mesh>
      {/* Inner glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.95, 16, 12]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function OrbitalRing({ color, radius, speed, tilt }: { color: string; radius: number; speed: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = tilt;
      ref.current.rotation.y = clock.getElapsedTime() * speed;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.06;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.005, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

function ParticleField({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 1500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute on sphere surface with some scatter
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + (Math.random() - 0.5) * 1.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return [pos];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.03;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.06;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.015}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
}

function FloatingParticles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return [pos];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.01;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.02;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={0.3}
      />
    </Points>
  );
}

// Generate a lightning arc between two random points on the globe surface
function generateBolt(radius: number): [number, number, number][] {
  const theta1 = Math.random() * Math.PI * 2;
  const phi1 = Math.acos(2 * Math.random() - 1);
  const theta2 = theta1 + (Math.random() - 0.5) * 2.5;
  const phi2 = phi1 + (Math.random() - 0.5) * 1.5;

  const p1 = new THREE.Vector3(
    radius * Math.sin(phi1) * Math.cos(theta1),
    radius * Math.cos(phi1),
    radius * Math.sin(phi1) * Math.sin(theta1)
  );
  const p2 = new THREE.Vector3(
    radius * Math.sin(phi2) * Math.cos(theta2),
    radius * Math.cos(phi2),
    radius * Math.sin(phi2) * Math.sin(theta2)
  );

  const segments = 12 + Math.floor(Math.random() * 8);
  const points: [number, number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Interpolate on sphere surface (slerp-like) then add jitter
    const pos = new THREE.Vector3().lerpVectors(p1, p2, t).normalize().multiplyScalar(radius);
    // Push outward slightly at midpoints for arc effect
    const arcLift = Math.sin(t * Math.PI) * 0.15;
    pos.multiplyScalar(1 + arcLift);
    // Add random jitter for electric feel
    if (i > 0 && i < segments) {
      pos.x += (Math.random() - 0.5) * 0.12;
      pos.y += (Math.random() - 0.5) * 0.12;
      pos.z += (Math.random() - 0.5) * 0.12;
    }
    points.push([pos.x, pos.y, pos.z]);
  }
  return points;
}

interface BoltData {
  id: number;
  points: [number, number, number][];
  opacity: number;
  birth: number;
}

let boltIdCounter = 0;

function ElectricBolts() {
  const boltColor = "#FFD60A";
  const [bolts, setBolts] = useState<BoltData[]>([]);
  const nextSpawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 0.8) * 0.06;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.08;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
      groupRef.current.scale.setScalar(breathe);
    }

    // Spawn new bolts randomly
    if (t > nextSpawn.current) {
      const newBolt: BoltData = {
        id: boltIdCounter++,
        points: generateBolt(2),
        opacity: 1,
        birth: t,
      };
      setBolts((prev) => [...prev.slice(-6), newBolt]); // max 7 bolts
      nextSpawn.current = t + 0.3 + Math.random() * 1.2; // 0.3-1.5s interval
    }

    // Fade out old bolts
    setBolts((prev) =>
      prev
        .map((b) => ({ ...b, opacity: Math.max(0, 1 - (t - b.birth) / 0.5) }))
        .filter((b) => b.opacity > 0)
    );
  });

  return (
    <group ref={groupRef}>
      {bolts.map((bolt) => (
        <Line
          key={bolt.id}
          points={bolt.points}
          color={boltColor}
          lineWidth={1.5}
          transparent
          opacity={bolt.opacity * 0.8}
        />
      ))}
    </group>
  );
}

function Scene({ color }: { color: string }) {
  return (
    <>
      <GlobeWireframe color={color} />
      <ElectricBolts />
      <ParticleField color={color} />
      <FloatingParticles color={color} />
      <OrbitalRing color={color} radius={2.8} speed={0.12} tilt={0.3} />
      <OrbitalRing color={color} radius={3.2} speed={-0.08} tilt={-0.5} />
      <OrbitalRing color={color} radius={2.5} speed={0.15} tilt={1.2} />
    </>
  );
}

export function CyberGlobe() {
  const { mode } = useMode();
  const color = modeColors[mode] || modeColors.war;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <Scene color={color} />
      </Canvas>
      {/* Radial vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 20%, hsl(var(--background)) 75%)`,
        }}
      />
    </div>
  );
}
