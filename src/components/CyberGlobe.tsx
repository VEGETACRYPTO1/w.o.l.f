import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";

const modeColors: Record<string, string> = {
  war: "#e04040",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

// ── Audio Reactivity ──
interface AudioData {
  avg: number; bass: number; mid: number; high: number;
  dataArray: Uint8Array;
}

function useAudioReactivity() {
  const [audioData, setAudioData] = useState<AudioData>({
    avg: 0, bass: 0, mid: 0, high: 0, dataArray: new Uint8Array(128),
  });
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const activeRef = useRef(false);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      streamRef.current = stream;
      ctxRef.current = ctx;
      activeRef.current = true;
    } catch { /* no mic */ }
  }, []);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (analyserRef.current && activeRef.current) {
        const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(arr);
        const bass = arr.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
        const mid = arr.slice(8, 40).reduce((a, b) => a + b, 0) / 32;
        const high = arr.slice(40, 80).reduce((a, b) => a + b, 0) / 40;
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        setAudioData({ avg, bass, mid, high, dataArray: arr });
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach(t => t.stop());
      ctxRef.current?.close();
    };
  }, []);

  return { audioData, startAudio: start };
}

function useMousePosition() {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return mouse;
}

function useClickPulse() {
  const pulse = useRef(0);
  useEffect(() => {
    const h = () => { pulse.current = 1; };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  return pulse;
}

// ── Dense Particle Sphere (the BRAIN — thousands of particles) ──
function DenseParticleSphere({ color, audioData, mouse, clickPulse }: {
  color: string; audioData: AudioData;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  clickPulse: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Points>(null);
  const count = 3000;
  const radius = 2;

  const basePositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // Distribute some particles inside the sphere for density
      const r = radius * (0.7 + Math.random() * 0.3);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  const positions = useMemo(() => new Float32Array(basePositions), [basePositions]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    clickPulse.current *= 0.93;
    const audioScale = 1 + audioData.avg * 0.002;
    const clickScale = 1 + clickPulse.current * 0.12;

    if (ref.current) {
      ref.current.rotation.y = t * 0.05 + mouse.current.x * 0.3;
      ref.current.rotation.x = mouse.current.y * 0.15 + Math.sin(t * 0.3) * 0.04;
      ref.current.scale.setScalar(audioScale * clickScale);

      // Subtle particle vibration
      const posAttr = ref.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const fi = i % audioData.dataArray.length;
        const freq = audioData.dataArray[fi] / 255;
        const v = freq * 0.05;
        posAttr.setXYZ(
          i,
          basePositions[i * 3] + Math.sin(t * 2 + i * 0.3) * 0.008 + v * Math.sin(t * 5 + i),
          basePositions[i * 3 + 1] + Math.cos(t * 1.8 + i * 0.2) * 0.008 + v * Math.cos(t * 4 + i),
          basePositions[i * 3 + 2] + Math.sin(t * 1.5 + i * 0.5) * 0.008 + v * Math.sin(t * 6 + i)
        );
      }
      posAttr.needsUpdate = true;
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
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// ── Connection Lines (thin, subtle, glowing) ──
function ConnectionNetwork({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    const nodeCount = 200;
    const nodes: THREE.Vector3[] = [];
    const radius = 2;

    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.75 + Math.random() * 0.25);
      nodes.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      ));
    }

    const maxDist = 0.55;
    let lineCount = 0;
    for (let i = 0; i < nodeCount && lineCount < 150; i++) {
      for (let j = i + 1; j < nodeCount && lineCount < 150; j++) {
        if (nodes[i].distanceTo(nodes[j]) < maxDist) {
          result.push([
            [nodes[i].x, nodes[i].y, nodes[i].z],
            [nodes[j].x, nodes[j].y, nodes[j].z],
          ]);
          lineCount++;
        }
      }
    }
    return result;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={ref}>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={0.3} transparent opacity={0.06} />
      ))}
    </group>
  );
}

// ── Holographic Hex Grid Shell ──
function HexGrid({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);
  const hexLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    const r = 2;
    const latSteps = 12;
    const lonSteps = 24;
    for (let i = 1; i < latSteps; i++) {
      const phi = (i / latSteps) * Math.PI;
      const pts: [number, number, number][] = [];
      for (let j = 0; j <= lonSteps; j++) {
        const theta = (j / lonSteps) * Math.PI * 2;
        pts.push([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]);
      }
      lines.push(pts);
    }
    for (let j = 0; j < lonSteps; j++) {
      const theta = (j / lonSteps) * Math.PI * 2;
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= latSteps; i++) {
        const phi = (i / latSteps) * Math.PI;
        pts.push([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]);
      }
      lines.push(pts);
    }
    return lines;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.04;
      ref.current.rotation.x = Math.sin(t * 0.25) * 0.06;
      ref.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
    }
  });

  return (
    <group ref={ref}>
      {hexLines.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={0.4} transparent opacity={0.08} />
      ))}
    </group>
  );
}

// ── Wireframe Shell ──
function GlobeShell({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.06;
      ref.current.rotation.x = Math.sin(t * 0.3) * 0.08;
      ref.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2, 36, 28]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.1} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── Surface Data Nodes ──
function DataNodes({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.02;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.06;
      ref.current.rotation.x = Math.sin(t * 0.3) * 0.08;
      ref.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent color={color} size={0.03} sizeAttenuation
        depthWrite={false} opacity={0.85} blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// ── Orbital Rings (light, glowing) ──
function OrbitalRing({ color, radius, speed, tilt, audioData }: {
  color: string; radius: number; speed: number; tilt: number; audioData: AudioData;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.z = tilt;
      ref.current.rotation.y = t * speed;
      ref.current.scale.setScalar(1 + audioData.mid * 0.001);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.15 + Math.sin(t * 1.5 + tilt * 2) * 0.08 + audioData.mid * 0.001;
    }
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.004, 8, 128]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── Electric Bolts (gold) ──
function generateBolt(radius: number): [number, number, number][] {
  const theta1 = Math.random() * Math.PI * 2;
  const phi1 = Math.acos(2 * Math.random() - 1);
  const theta2 = theta1 + (Math.random() - 0.5) * 2.5;
  const phi2 = phi1 + (Math.random() - 0.5) * 1.5;
  const p1 = new THREE.Vector3(radius * Math.sin(phi1) * Math.cos(theta1), radius * Math.cos(phi1), radius * Math.sin(phi1) * Math.sin(theta1));
  const p2 = new THREE.Vector3(radius * Math.sin(phi2) * Math.cos(theta2), radius * Math.cos(phi2), radius * Math.sin(phi2) * Math.sin(theta2));
  const segments = 14 + Math.floor(Math.random() * 10);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = new THREE.Vector3().lerpVectors(p1, p2, t).normalize().multiplyScalar(radius);
    pos.multiplyScalar(1 + Math.sin(t * Math.PI) * 0.12);
    if (i > 0 && i < segments) {
      pos.x += (Math.random() - 0.5) * 0.1;
      pos.y += (Math.random() - 0.5) * 0.1;
      pos.z += (Math.random() - 0.5) * 0.1;
    }
    points.push([pos.x, pos.y, pos.z]);
  }
  return points;
}

interface BoltData { id: number; points: [number, number, number][]; opacity: number; birth: number; }
let boltIdCounter = 0;

function ElectricBolts({ audioData }: { audioData: AudioData }) {
  const [bolts, setBolts] = useState<BoltData[]>([]);
  const nextSpawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.06;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.08;
      groupRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
    }
    const spawnRate = Math.max(0.08, 0.4 - audioData.avg * 0.002);
    if (t > nextSpawn.current) {
      setBolts(prev => [...prev.slice(-10), { id: boltIdCounter++, points: generateBolt(2), opacity: 1, birth: t }]);
      nextSpawn.current = t + spawnRate + Math.random() * 0.4;
    }
    setBolts(prev => prev.map(b => ({ ...b, opacity: Math.max(0, 1 - (t - b.birth) / 0.35) })).filter(b => b.opacity > 0));
  });

  return (
    <group ref={groupRef}>
      {bolts.map(bolt => (
        <group key={bolt.id}>
          <Line points={bolt.points} color="#FFD60A" lineWidth={2} transparent opacity={bolt.opacity * 0.9} />
          <Line points={bolt.points} color="#FFEA00" lineWidth={0.8} transparent opacity={bolt.opacity * 0.35} />
        </group>
      ))}
    </group>
  );
}

// ── Particle Cloud (atmosphere) ──
function ParticleCloud({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + (Math.random() - 0.5) * 1.4;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.02;
      ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.02);
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color={color} size={0.01} sizeAttenuation depthWrite={false} opacity={0.4} blending={THREE.AdditiveBlending} />
    </Points>
  );
}

// ── Floating Stars ──
function FloatingStars({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 250;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.006;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color={color} size={0.012} sizeAttenuation depthWrite={false} opacity={0.15} blending={THREE.AdditiveBlending} />
    </Points>
  );
}

// ── Camera Drift ──
function CameraDrift({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.12) * 0.12 + mouse.current.x * 0.25;
    camera.position.y = Math.cos(t * 0.1) * 0.08 + mouse.current.y * 0.15;
    camera.position.z = 5.5 + Math.sin(t * 0.08) * 0.08;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── Main Scene ──
function Scene({ color }: { color: string }) {
  const { audioData, startAudio } = useAudioReactivity();
  const mouse = useMousePosition();
  const clickPulse = useClickPulse();

  useEffect(() => {
    const h = () => { startAudio(); window.removeEventListener("click", h); };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [startAudio]);

  useEffect(() => {
    const h = () => { clickPulse.current = Math.min(clickPulse.current + 0.15, 0.5); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [clickPulse]);

  return (
    <>
      <CameraDrift mouse={mouse} />

      {/* Dense particle sphere — the core structure */}
      <DenseParticleSphere color={color} audioData={audioData} mouse={mouse} clickPulse={clickPulse} />
      <ConnectionNetwork color={color} />
      <HexGrid color={color} />
      <GlobeShell color={color} />
      <DataNodes color={color} />

      {/* Electric energy */}
      <ElectricBolts audioData={audioData} />

      {/* Orbital rings — light, not dominant */}
      <OrbitalRing color={color} radius={2.8} speed={0.12} tilt={0.3} audioData={audioData} />
      <OrbitalRing color={color} radius={3.2} speed={-0.08} tilt={-0.5} audioData={audioData} />
      <OrbitalRing color={color} radius={2.5} speed={0.15} tilt={1.2} audioData={audioData} />

      {/* Atmosphere */}
      <ParticleCloud color={color} />
      <FloatingStars color={color} />
    </>
  );
}

export function CyberGlobe() {
  const { mode } = useMode();
  const color = modeColors[mode] || modeColors.war;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute inset-0 pointer-events-auto">
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 50 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
          style={{ background: "transparent" }}
        >
          <Scene color={color} />
        </Canvas>
      </div>
      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, transparent 20%, hsl(var(--background)) 75%)` }}
      />
      {/* Soft inner glow instead of solid core */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
      >
        <div style={{
          width: "280px", height: "280px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,59,59,0.12) 0%, rgba(255,59,59,0.04) 40%, transparent 70%)",
          filter: "blur(20px)",
        }} />
      </div>
    </div>
  );
}
