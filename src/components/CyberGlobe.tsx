import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { useEffect } from "react";

const modeColors: Record<string, string> = {
  war: "#FF3B3B",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

// ── Bloom ──
function BloomEffect() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.2, 0.4, 0.1
    );
    composer.addPass(bloom);
    composerRef.current = composer;
    return () => { composer.dispose(); };
  }, [gl, scene, camera, size]);

  useFrame(() => { composerRef.current?.render(); }, 1);
  return null;
}

// ── 4000-particle sphere with breathing + opacity pulse ──
function ParticleSphere({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
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

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y += 0.0015;
      ref.current.rotation.x += 0.0005;
      // Breathing
      const scale = 1 + Math.sin(t * 0.8) * 0.12;
      ref.current.scale.setScalar(scale);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.7 + Math.sin(t * 0.5) * 0.2;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={color}
        size={0.015}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
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
    let c = 0;
    for (let i = 0; i < nodeCount && c < 120; i++) {
      for (let j = i + 1; j < nodeCount && c < 120; j++) {
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < maxDist) {
          result.push([nodes[i], nodes[j]]);
          c++;
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

// ── Neuron Signals ──
interface Signal {
  id: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
}

let signalId = 0;

function randomSurfacePoint(radius: number): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 2 - 1);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );
}

function NeuronSignals({ color }: { color: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const nextSpawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const maxSignals = 12;
  const radius = 2;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Rotate with sphere
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015;
      groupRef.current.rotation.x += 0.0005;
    }

    // Spawn signals
    if (t > nextSpawn.current && signals.length < maxSignals) {
      const s: Signal = {
        id: signalId++,
        start: randomSurfacePoint(radius),
        end: randomSurfacePoint(radius),
        progress: 0,
        speed: 0.008 + Math.random() * 0.008,
      };
      setSignals(prev => [...prev, s]);
      nextSpawn.current = t + 0.3 + Math.random() * 0.5;
    }

    // Advance and cull
    setSignals(prev =>
      prev
        .map(s => ({ ...s, progress: s.progress + s.speed }))
        .filter(s => s.progress <= 1)
    );
  });

  return (
    <group ref={groupRef}>
      {signals.map(s => {
        // Interpolate along great-circle (spherical lerp on surface)
        const p = new THREE.Vector3().lerpVectors(s.start, s.end, s.progress).normalize().multiplyScalar(radius);
        const opacity = Math.sin(s.progress * Math.PI); // fade in/out
        return (
          <mesh key={s.id} position={[p.x, p.y, p.z]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity * 0.9}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
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
      <NeuronSignals color={color} />
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
