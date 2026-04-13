import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const modeColors: Record<string, string> = {
  war: "#FF3B3B",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

// ── Bloom Post-Processing ──
function BloomEffect() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.2,   // strength
      0.4,   // radius
      0.1    // threshold
    );
    composer.addPass(bloom);
    composerRef.current = composer;
    return () => { composer.dispose(); };
  }, [gl, scene, camera, size]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}

// ── Dense Particle Sphere: 4000 particles, additive, subtle rotation ──
function ParticleSphere({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const count = 4000;
  const radius = 2;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.0015;
      ref.current.rotation.x += 0.0005;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        color={color}
        size={0.015}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </Points>
  );
}

// ── Connection Lines (thin, low opacity) ──
function ConnectionLines({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    const nodeCount = 250;
    const radius = 2;
    const nodes: [number, number, number][] = [];

    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      nodes.push([
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
      ]);
    }

    const maxDist = 0.5;
    let count = 0;
    for (let i = 0; i < nodeCount && count < 120; i++) {
      for (let j = i + 1; j < nodeCount && count < 120; j++) {
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < maxDist) {
          result.push([nodes[i], nodes[j]]);
          count++;
        }
      }
    }
    return result;
  }, []);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.0015;
      ref.current.rotation.x += 0.0005;
    }
  });

  return (
    <group ref={ref}>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={0.3} transparent opacity={0.07} />
      ))}
    </group>
  );
}

// ── Electric Bolts (gold arcs on surface) ──
function generateBolt(radius: number): [number, number, number][] {
  const theta1 = Math.random() * Math.PI * 2;
  const phi1 = Math.acos(Math.random() * 2 - 1);
  const theta2 = theta1 + (Math.random() - 0.5) * 2.5;
  const phi2 = phi1 + (Math.random() - 0.5) * 1.5;
  const p1 = new THREE.Vector3(radius * Math.sin(phi1) * Math.cos(theta1), radius * Math.cos(phi1), radius * Math.sin(phi1) * Math.sin(theta1));
  const p2 = new THREE.Vector3(radius * Math.sin(phi2) * Math.cos(theta2), radius * Math.cos(phi2), radius * Math.sin(phi2) * Math.sin(theta2));
  const segments = 14 + Math.floor(Math.random() * 10);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = new THREE.Vector3().lerpVectors(p1, p2, t).normalize().multiplyScalar(radius);
    pos.multiplyScalar(1 + Math.sin(t * Math.PI) * 0.1);
    if (i > 0 && i < segments) {
      pos.x += (Math.random() - 0.5) * 0.08;
      pos.y += (Math.random() - 0.5) * 0.08;
      pos.z += (Math.random() - 0.5) * 0.08;
    }
    points.push([pos.x, pos.y, pos.z]);
  }
  return points;
}

interface BoltData { id: number; points: [number, number, number][]; opacity: number; birth: number; }
let boltId = 0;

function ElectricBolts() {
  const [bolts, setBolts] = useState<BoltData[]>([]);
  const nextSpawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015;
      groupRef.current.rotation.x += 0.0005;
    }
    if (t > nextSpawn.current) {
      setBolts(prev => [...prev.slice(-8), { id: boltId++, points: generateBolt(2), opacity: 1, birth: t }]);
      nextSpawn.current = t + 0.2 + Math.random() * 0.6;
    }
    setBolts(prev => prev.map(b => ({ ...b, opacity: Math.max(0, 1 - (t - b.birth) / 0.35) })).filter(b => b.opacity > 0));
  });

  return (
    <group ref={groupRef}>
      {bolts.map(b => (
        <group key={b.id}>
          <Line points={b.points} color="#FFD60A" lineWidth={2} transparent opacity={b.opacity * 0.85} />
          <Line points={b.points} color="#FFEA00" lineWidth={0.7} transparent opacity={b.opacity * 0.3} />
        </group>
      ))}
    </group>
  );
}

// ── Orbital Rings ──
function OrbitalRing({ color, radius, speed, tilt }: { color: string; radius: number; speed: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.z = tilt;
      ref.current.rotation.y = t * speed;
    }
    if (matRef.current) {
      matRef.current.opacity = 0.15 + Math.sin(t * 1.5 + tilt) * 0.08;
    }
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.004, 8, 128]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── Background Stars ──
function BackgroundStars() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.005;
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color="#ffffff" size={0.008} sizeAttenuation depthWrite={false} opacity={0.15} blending={THREE.AdditiveBlending} />
    </Points>
  );
}

// ── Scene ──
function Scene({ color }: { color: string }) {
  return (
    <>
      <color attach="background" args={["#050507"]} />
      <BloomEffect />
      <ParticleSphere color={color} />
      <ConnectionLines color={color} />
      <ElectricBolts />
      <OrbitalRing color={color} radius={2.8} speed={0.12} tilt={0.3} />
      <OrbitalRing color={color} radius={3.2} speed={-0.08} tilt={-0.5} />
      <OrbitalRing color={color} radius={2.5} speed={0.15} tilt={1.2} />
      <BackgroundStars />
    </>
  );
}

export function CyberGlobe() {
  const { mode } = useMode();
  const color = modeColors[mode] || modeColors.war;

  return (
    <div className="fixed inset-0" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "#050507" }}
      >
        <Scene color={color} />
      </Canvas>
    </div>
  );
}
