import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, Line, EffectComposer, Bloom } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";

const modeColors: Record<string, string> = {
  war: "#e04040",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

// ── Audio Analyzer Context ──
interface AudioData {
  avg: number;
  bass: number;
  mid: number;
  high: number;
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
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      streamRef.current = stream;
      ctxRef.current = ctx;
      activeRef.current = true;
    } catch {
      // Permission denied – run without audio
    }
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

  return { audioData, startAudio: start, active: activeRef.current };
}

// ── Mouse tracker ──
function useMousePosition() {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return mouse;
}

// ── Click pulse ──
function useClickPulse() {
  const pulse = useRef(0);
  useEffect(() => {
    const handler = () => { pulse.current = 1; };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);
  return pulse;
}

// ── Particle Brain Sphere ──
function ParticleBrain({ color, audioData, mouse, clickPulse }: {
  color: string; audioData: AudioData;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  clickPulse: React.MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 2000;
  const radius = 2;

  const [basePositions, positions] = useMemo(() => {
    const base = new Float32Array(count * 3);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius;
      base[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      base[i * 3 + 1] = r * Math.cos(phi);
      base[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3] = base[i * 3];
      pos[i * 3 + 1] = base[i * 3 + 1];
      pos[i * 3 + 2] = base[i * 3 + 2];
    }
    return [base, pos];
  }, []);

  // Connection lines between nearby particles
  const connectionLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    const maxDist = 0.7;
    const maxLines = 120;
    let lineCount = 0;
    for (let i = 0; i < count && lineCount < maxLines; i += 3) {
      for (let j = i + 3; j < count && lineCount < maxLines; j += 5) {
        const dx = basePositions[i * 3] - basePositions[j * 3];
        const dy = basePositions[i * 3 + 1] - basePositions[j * 3 + 1];
        const dz = basePositions[i * 3 + 2] - basePositions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDist) {
          lines.push([
            [basePositions[i * 3], basePositions[i * 3 + 1], basePositions[i * 3 + 2]],
            [basePositions[j * 3], basePositions[j * 3 + 1], basePositions[j * 3 + 2]],
          ]);
          lineCount++;
        }
      }
    }
    return lines;
  }, [basePositions]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const audioScale = 1 + audioData.avg * 0.002;
    const clickScale = 1 + clickPulse.current * 0.15;

    // Decay click pulse
    clickPulse.current *= 0.92;

    if (pointsRef.current) {
      // Mouse tilt
      pointsRef.current.rotation.y = t * 0.05 + mouse.current.x * 0.3;
      pointsRef.current.rotation.x = mouse.current.y * 0.2 + Math.sin(t * 0.3) * 0.05;

      // Audio + click scale
      const s = audioScale * clickScale;
      pointsRef.current.scale.setScalar(s);

      // Vibrate particles with audio
      const geo = pointsRef.current.geometry;
      const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const freqIndex = i % audioData.dataArray.length;
        const freq = audioData.dataArray[freqIndex] / 255;
        const vibrate = freq * 0.08;
        posAttr.setXYZ(
          i,
          basePositions[i * 3] + (Math.sin(t * 3 + i) * 0.01 + vibrate * Math.sin(t * 5 + i * 0.5)),
          basePositions[i * 3 + 1] + (Math.cos(t * 2.5 + i) * 0.01 + vibrate * Math.cos(t * 4 + i * 0.3)),
          basePositions[i * 3 + 2] + (Math.sin(t * 2 + i * 0.7) * 0.01 + vibrate * Math.sin(t * 6 + i * 0.2))
        );
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      <Points ref={pointsRef} positions={positions} stride={3}>
        <PointMaterial
          transparent
          color={color}
          size={0.025}
          sizeAttenuation
          depthWrite={false}
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      {/* Faint connection lines */}
      <group>
        {connectionLines.map((pts, i) => (
          <Line
            key={i}
            points={pts}
            color={color}
            lineWidth={0.3}
            transparent
            opacity={0.08}
          />
        ))}
      </group>
    </group>
  );
}

// ── Energy Core (Heart) ──
function EnergyCore({ color, audioData, clickPulse }: {
  color: string; audioData: AudioData;
  clickPulse: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const bassPulse = 1 + audioData.bass * 0.003;
    const clickScale = 1 + clickPulse.current * 0.3;
    const pulse = Math.sin(t * 2) * 0.08 + 1;
    const s = pulse * bassPulse * clickScale;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(s * 0.5);
      meshRef.current.rotation.y = t * 0.3;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(s * 0.8);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.6 + audioData.bass * 0.003 + clickPulse.current * 0.2;
    }
    if (glowMatRef.current) {
      glowMatRef.current.opacity = 0.15 + audioData.bass * 0.002 + Math.sin(t * 3) * 0.05;
    }
  });

  return (
    <group>
      {/* Inner bright core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.2, 24, 24]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color={color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ── Orbital Rings ──
function OrbitalRing({ color, radius, speed, tilt, audioData }: {
  color: string; radius: number; speed: number; tilt: number;
  audioData: AudioData;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.z = tilt;
      ref.current.rotation.y = t * speed;
      ref.current.rotation.x = Math.sin(t * 0.5 + tilt) * 0.1;
      const audioScale = 1 + audioData.mid * 0.001;
      ref.current.scale.setScalar(audioScale);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.15 + Math.sin(t * 1.5 + tilt * 2) * 0.1 + audioData.mid * 0.001;
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.006, 8, 128]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Electric Bolts ──
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

interface BoltData { id: number; points: [number, number, number][]; opacity: number; birth: number; }
let boltIdCounter = 0;

function ElectricBolts({ audioData }: { audioData: AudioData }) {
  const boltColor = "#FFD60A";
  const [bolts, setBolts] = useState<BoltData[]>([]);
  const nextSpawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.08;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
    }

    // Faster spawning with more audio
    const spawnRate = Math.max(0.05, 0.4 - audioData.avg * 0.002);
    if (t > nextSpawn.current) {
      const newBolt: BoltData = {
        id: boltIdCounter++,
        points: generateBolt(2),
        opacity: 1,
        birth: t,
      };
      setBolts((prev) => [...prev.slice(-10), newBolt]);
      nextSpawn.current = t + spawnRate + Math.random() * 0.3;
    }

    setBolts((prev) =>
      prev
        .map((b) => ({ ...b, opacity: Math.max(0, 1 - (t - b.birth) / 0.35) }))
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
            lineWidth={2.5}
            transparent
            opacity={bolt.opacity * 0.9}
          />
          <Line
            points={bolt.points}
            color="#FFEA00"
            lineWidth={1}
            transparent
            opacity={bolt.opacity * 0.4}
          />
        </group>
      ))}
    </group>
  );
}

// ── Scan Ring ──
function ScanRing({ color, audioData }: { color: string; audioData: AudioData }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.position.y = Math.sin(t * 0.5) * 2;
      ref.current.rotation.x = Math.PI / 2;
      const scale = 1 - Math.abs(ref.current.position.y) / 3;
      ref.current.scale.set(scale, scale, scale);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.3 + audioData.high * 0.002;
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[2, 0.008, 8, 128]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Background Atmosphere Particles ──
function AtmosphereParticles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return [pos];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.008;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.15) * 0.02;
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
        opacity={0.2}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// ── Camera Drift ──
function CameraDrift({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  const basePos = useRef(new THREE.Vector3(0, 0, 5.5));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = basePos.current.x + Math.sin(t * 0.15) * 0.15 + mouse.current.x * 0.3;
    camera.position.y = basePos.current.y + Math.cos(t * 0.12) * 0.1 + mouse.current.y * 0.2;
    camera.position.z = basePos.current.z + Math.sin(t * 0.08) * 0.1;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ── Hex Grid Shell ──
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
    }
  });

  return (
    <group ref={ref}>
      {hexLines.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={0.4} transparent opacity={0.06} />
      ))}
    </group>
  );
}

// ── Main Scene ──
function Scene({ color }: { color: string }) {
  const { audioData, startAudio } = useAudioReactivity();
  const mouse = useMousePosition();
  const clickPulse = useClickPulse();

  // Try to start audio on first interaction
  useEffect(() => {
    const handler = () => { startAudio(); window.removeEventListener("click", handler); };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [startAudio]);

  // Typing reactivity
  useEffect(() => {
    const handler = () => { clickPulse.current = Math.min(clickPulse.current + 0.15, 0.5); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clickPulse]);

  return (
    <>
      <CameraDrift mouse={mouse} />
      <fog attach="fog" args={["#000000", 5, 15]} />

      {/* Core systems */}
      <EnergyCore color={color} audioData={audioData} clickPulse={clickPulse} />
      <ParticleBrain color={color} audioData={audioData} mouse={mouse} clickPulse={clickPulse} />
      <HexGrid color={color} />

      {/* Electric current */}
      <ScanRing color="#FFD60A" audioData={audioData} />
      <ElectricBolts audioData={audioData} />

      {/* Orbital rings */}
      <OrbitalRing color={color} radius={2.6} speed={0.15} tilt={0.3} audioData={audioData} />
      <OrbitalRing color={color} radius={3.0} speed={-0.1} tilt={-0.6} audioData={audioData} />
      <OrbitalRing color={color} radius={3.4} speed={0.08} tilt={1.1} audioData={audioData} />
      <OrbitalRing color={color} radius={2.3} speed={-0.18} tilt={0.8} audioData={audioData} />
      <OrbitalRing color={color} radius={3.8} speed={0.05} tilt={-0.2} audioData={audioData} />

      {/* Atmosphere */}
      <AtmosphereParticles color={color} />
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
        style={{
          background: `radial-gradient(ellipse at center, transparent 15%, hsl(var(--background)) 70%)`,
        }}
      />
      {/* Subtle fog overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.03) 0%, transparent 50%)`,
        }}
      />
    </div>
  );
}
