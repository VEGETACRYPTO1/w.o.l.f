import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";

const GLOBE_COLOR = "#FFD60A";
const GLOBE_COLOR_DIM = "#FFC300";
const BOLT_COLOR = "#FFD60A";

function GlobeWireframe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 0.6) * 0.08;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.06;
      meshRef.current.rotation.x = Math.sin(t * 0.25) * 0.12;
      meshRef.current.scale.setScalar(breathe);
    }
    if (glowRef.current) {
      glowRef.current.rotation.y = -t * 0.04;
      glowRef.current.rotation.x = Math.cos(t * 0.2) * 0.08;
      glowRef.current.scale.setScalar(breathe * 1.01);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.1;
      innerRef.current.scale.setScalar(breathe * 0.98);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 48, 36]} />
        <meshBasicMaterial color={GLOBE_COLOR} wireframe transparent opacity={0.35} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.96, 24, 18]} />
        <meshBasicMaterial color={GLOBE_COLOR_DIM} wireframe transparent opacity={0.15} />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[1.5, 20, 16]} />
        <meshBasicMaterial color={GLOBE_COLOR} wireframe transparent opacity={0.1} />
      </mesh>
      {/* Solid inner glow core */}
      <mesh>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color={GLOBE_COLOR} transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function OrbitalRing({ radius, speed, tilt, opacity = 0.3 }: { radius: number; speed: number; tilt: number; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = tilt;
      ref.current.rotation.y = clock.getElapsedTime() * speed;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.6) * 0.08;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.008, 8, 128]} />
      <meshBasicMaterial color={GLOBE_COLOR} transparent opacity={opacity} />
    </mesh>
  );
}

function DenseParticleField() {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.8 + (Math.random()) * 0.6;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return [pos];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.04;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.6) * 0.08;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color={GLOBE_COLOR} size={0.012} sizeAttenuation depthWrite={false} opacity={0.7} />
    </Points>
  );
}

function OuterParticles() {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return [pos];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.015;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.03;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color={GLOBE_COLOR_DIM} size={0.018} sizeAttenuation depthWrite={false} opacity={0.35} />
    </Points>
  );
}

// Radial spikes/rays emanating from globe
function EnergyRays() {
  const groupRef = useRef<THREE.Group>(null);

  const rays = useMemo(() => {
    return Array.from({ length: 30 }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const start = 2.05;
      const end = start + 0.3 + Math.random() * 1.2;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );
      return {
        points: [
          [dir.x * start, dir.y * start, dir.z * start] as [number, number, number],
          [dir.x * end, dir.y * end, dir.z * end] as [number, number, number],
        ],
        opacity: 0.15 + Math.random() * 0.25,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.06;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.6) * 0.08;
      groupRef.current.scale.setScalar(breathe);
    }
  });

  return (
    <group ref={groupRef}>
      {rays.map((ray, i) => (
        <Line key={i} points={ray.points} color={GLOBE_COLOR} lineWidth={0.8} transparent opacity={ray.opacity} />
      ))}
    </group>
  );
}

function generateBolt(radius: number): [number, number, number][] {
  const theta1 = Math.random() * Math.PI * 2;
  const phi1 = Math.acos(2 * Math.random() - 1);
  const theta2 = theta1 + (Math.random() - 0.5) * 2.5;
  const phi2 = phi1 + (Math.random() - 0.5) * 1.5;

  const p1 = new THREE.Vector3(radius * Math.sin(phi1) * Math.cos(theta1), radius * Math.cos(phi1), radius * Math.sin(phi1) * Math.sin(theta1));
  const p2 = new THREE.Vector3(radius * Math.sin(phi2) * Math.cos(theta2), radius * Math.cos(phi2), radius * Math.sin(phi2) * Math.sin(theta2));

  const segments = 14 + Math.floor(Math.random() * 8);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = new THREE.Vector3().lerpVectors(p1, p2, t).normalize().multiplyScalar(radius);
    const arcLift = Math.sin(t * Math.PI) * 0.2;
    pos.multiplyScalar(1 + arcLift);
    if (i > 0 && i < segments) {
      pos.x += (Math.random() - 0.5) * 0.15;
      pos.y += (Math.random() - 0.5) * 0.15;
      pos.z += (Math.random() - 0.5) * 0.15;
    }
    points.push([pos.x, pos.y, pos.z]);
  }
  return points;
}

interface BoltData { id: number; points: [number, number, number][]; opacity: number; birth: number; }
let boltIdCounter = 0;

function ElectricBolts() {
  const [bolts, setBolts] = useState<BoltData[]>([]);
  const nextSpawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 0.6) * 0.08;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.06;
      groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.12;
      groupRef.current.scale.setScalar(breathe);
    }
    if (t > nextSpawn.current) {
      const newBolt: BoltData = { id: boltIdCounter++, points: generateBolt(2), opacity: 1, birth: t };
      setBolts((prev) => [...prev.slice(-8), newBolt]);
      nextSpawn.current = t + 0.15 + Math.random() * 0.8;
    }
    setBolts((prev) => prev.map((b) => ({ ...b, opacity: Math.max(0, 1 - (t - b.birth) / 0.4) })).filter((b) => b.opacity > 0));
  });

  return (
    <group ref={groupRef}>
      {bolts.map((bolt) => (
        <Line key={bolt.id} points={bolt.points} color={BOLT_COLOR} lineWidth={1.8} transparent opacity={bolt.opacity * 0.9} />
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <GlobeWireframe />
      <ElectricBolts />
      <DenseParticleField />
      <OuterParticles />
      <EnergyRays />
      <OrbitalRing radius={2.8} speed={0.12} tilt={0.3} />
      <OrbitalRing radius={3.2} speed={-0.08} tilt={-0.5} opacity={0.2} />
      <OrbitalRing radius={2.5} speed={0.15} tilt={1.2} />
      <OrbitalRing radius={3.6} speed={0.06} tilt={0.8} opacity={0.15} />
      <OrbitalRing radius={2.2} speed={-0.1} tilt={-1.0} opacity={0.2} />
    </>
  );
}

export function CyberGlobe() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 5.5], fov: 50 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
        <Scene />
      </Canvas>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 25%, hsl(var(--background)) 70%)` }} />
    </div>
  );
}
