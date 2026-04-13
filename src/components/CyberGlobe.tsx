import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";

const modeColors: Record<string, string> = {
  war: "#e04040",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

// Holographic hex grid shell (Jarvis-style)
function HexGrid({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);

  const hexLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    const radius = 2;
    // Create hex-like grid lines on sphere using lat/long
    const latSteps = 12;
    const lonSteps = 24;

    // Latitude rings
    for (let i = 1; i < latSteps; i++) {
      const phi = (i / latSteps) * Math.PI;
      const points: [number, number, number][] = [];
      for (let j = 0; j <= lonSteps; j++) {
        const theta = (j / lonSteps) * Math.PI * 2;
        points.push([
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ]);
      }
      lines.push(points);
    }

    // Longitude lines
    for (let j = 0; j < lonSteps; j++) {
      const theta = (j / lonSteps) * Math.PI * 2;
      const points: [number, number, number][] = [];
      for (let i = 0; i <= latSteps; i++) {
        const phi = (i / latSteps) * Math.PI;
        points.push([
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ]);
      }
      lines.push(points);
    }

    return lines;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.06;
      ref.current.rotation.x = Math.sin(t * 0.25) * 0.08;
      const breathe = 1 + Math.sin(t * 0.8) * 0.03;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <group ref={ref}>
      {hexLines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={color}
          lineWidth={0.5}
          transparent
          opacity={0.12}
        />
      ))}
    </group>
  );
}

// Inner holographic core sphere with scan-line effect
function HoloCore({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = -t * 0.04;
      const breathe = 1 + Math.sin(t * 0.8) * 0.03;
      meshRef.current.scale.setScalar(breathe * 0.95);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.98, 48, 36]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.06} />
    </mesh>
  );
}

// Outer wireframe shell
function GlobeShell({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.08;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
      const breathe = 1 + Math.sin(t * 0.8) * 0.03;
      meshRef.current.scale.setScalar(breathe);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2, 36, 28]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.18} />
    </mesh>
  );
}

// Data nodes on the globe surface (like Jarvis data points)
function DataNodes({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, sizes] = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.02;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sz[i] = 0.02 + Math.random() * 0.03;
    }
    return [pos, sz];
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.08;
      ref.current.rotation.x = Math.sin(t * 0.3) * 0.1;
      const breathe = 1 + Math.sin(t * 0.8) * 0.03;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.035}
        sizeAttenuation
        depthWrite={false}
        opacity={0.8}
      />
    </Points>
  );
}

// Scanning ring that sweeps across the globe
function ScanRing({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      // Sweep up and down
      ref.current.position.y = Math.sin(t * 0.5) * 2;
      ref.current.rotation.x = Math.PI / 2;
      const breathe = 1 + Math.sin(t * 0.8) * 0.03;
      const scale = breathe * (1 - Math.abs(ref.current.position.y) / 3);
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[2, 0.008, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}

function OrbitalRing({ color, radius, speed, tilt }: { color: string; radius: number; speed: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = tilt;
      ref.current.rotation.y = clock.getElapsedTime() * speed;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.03;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.004, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} />
    </mesh>
  );
}

function ParticleField({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + (Math.random() - 0.5) * 1.2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return [pos];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.03;
      const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.03;
      ref.current.scale.setScalar(breathe);
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.012}
        sizeAttenuation
        depthWrite={false}
        opacity={0.5}
      />
    </Points>
  );
}

function FloatingParticles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 200;
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
        size={0.015}
        sizeAttenuation
        depthWrite={false}
        opacity={0.2}
      />
    </Points>
  );
}

// Generate lightning arc
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

  const segments = 14 + Math.floor(Math.random() * 10);
  const points: [number, number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = new THREE.Vector3().lerpVectors(p1, p2, t).normalize().multiplyScalar(radius);
    const arcLift = Math.sin(t * Math.PI) * 0.12;
    pos.multiplyScalar(1 + arcLift);
    if (i > 0 && i < segments) {
      pos.x += (Math.random() - 0.5) * 0.1;
      pos.y += (Math.random() - 0.5) * 0.1;
      pos.z += (Math.random() - 0.5) * 0.1;
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
    const breathe = 1 + Math.sin(t * 0.8) * 0.03;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.08;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
      groupRef.current.scale.setScalar(breathe);
    }

    if (t > nextSpawn.current) {
      const newBolt: BoltData = {
        id: boltIdCounter++,
        points: generateBolt(2),
        opacity: 1,
        birth: t,
      };
      setBolts((prev) => [...prev.slice(-8), newBolt]);
      nextSpawn.current = t + 0.15 + Math.random() * 0.8; // faster spawning
    }

    setBolts((prev) =>
      prev
        .map((b) => ({ ...b, opacity: Math.max(0, 1 - (t - b.birth) / 0.4) }))
        .filter((b) => b.opacity > 0)
    );
  });

  return (
    <group ref={groupRef}>
      {bolts.map((bolt) => (
        <group key={bolt.id}>
          <Line
            points={bolt.points}
            color={boltColor}
            lineWidth={2}
            transparent
            opacity={bolt.opacity * 0.9}
          />
          {/* Secondary dimmer bolt for glow effect */}
          <Line
            points={bolt.points}
            color="#FFEA00"
            lineWidth={0.8}
            transparent
            opacity={bolt.opacity * 0.4}
          />
        </group>
      ))}
    </group>
  );
}

function Scene({ color }: { color: string }) {
  return (
    <>
      <HexGrid color={color} />
      <HoloCore color={color} />
      <GlobeShell color={color} />
      <DataNodes color={color} />
      <ScanRing color="#FFD60A" />
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
