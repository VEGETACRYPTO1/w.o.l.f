import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { getSpeakingIntensity } from "@/lib/brainEvents";
import type { WakePhase } from "@/contexts/WakeContext";

const GOLD = new THREE.Color("#FFD36B");
const GOLD_HI = new THREE.Color("#FFE9A8");
const WHITE = new THREE.Color("#ffffff");

function Bloom() {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    // Tighter, sharper bloom — like brain nodes, not a glowing blob
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 1.6, 0.55, 0.05));
    composer.current = c;
    return () => c.dispose();
  }, [gl, scene, camera, size]);
  useFrame(() => composer.current?.render(), 1);
  return null;
}

// ── Sparse deep-space starfield ──
function Starfield() {
  const ref = useRef<THREE.Points>(null);
  const { positions, sizes } = useMemo(() => {
    const COUNT = 350;
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // distribute on a far sphere shell
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 8 + Math.random() * 6;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 4;
      sizes[i] = 0.015 + Math.random() * 0.025;
    }
    return { positions, sizes };
  }, []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.005;
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        color="#ffffff"
        size={0.025}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

function Orb({ phase }: { phase: WakePhase }) {
  const phaseRef = useRef(phase);
  const phaseStartRef = useRef(performance.now() / 1000);
  useEffect(() => {
    phaseRef.current = phase;
    phaseStartRef.current = performance.now() / 1000;
    if (phase === "waking") triggerBurst();
  }, [phase]);

  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Bigger pool but tiny particles → cinematic spray
  const POOL = 600;
  const positions = useMemo(() => new Float32Array(POOL * 3), []);
  const colorsArr = useMemo(() => new Float32Array(POOL * 3), []);
  const particleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colorsArr, 3));
    return g;
  }, [positions, colorsArr]);
  const particles = useRef<Particle[]>([]);

  const triggerBurst = () => {
    const arr: Particle[] = [];
    for (let i = 0; i < POOL; i++) {
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      const speed = 2.5 + Math.random() * 4.5;
      arr.push({
        pos: new THREE.Vector3(0, 0, 0),
        vel: dir.multiplyScalar(speed),
        life: 1,
      });
    }
    particles.current = arr;
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = performance.now() / 1000;
    const audio = getSpeakingIntensity();

    const phaseAge = t - phaseStartRef.current;
    const p = phaseRef.current;

    // Slow breath, subtle audio reactivity
    const breath = 1 + Math.sin(t * 0.7) * 0.15 + audio * 0.25;

    let sizeMul = 1;
    let intensityMul = 1;
    let rotSpeed = 0.3;
    let opacityMul = 1;

    if (p === "waking") {
      const a = phaseAge;
      if (a < 1.0) {
        // Long cinematic charge: compress, brighten, spin up
        const k = a / 1.0;
        const eased = k * k;
        sizeMul = 1 - eased * 0.45;
        intensityMul = 1 + eased * 4.5;
        rotSpeed = 0.3 + eased * 8;
        opacityMul = 1;
      } else if (a < 1.15) {
        // Snap: implode + explode flash
        sizeMul = 0.0;
        intensityMul = 6;
        opacityMul = 0;
      } else {
        // Smooth fade-out remnant overlapping with brain forming
        const k = Math.min(1, (a - 1.15) / 1.2);
        sizeMul = 0;
        opacityMul = Math.max(0, 1 - k);
      }
    }

    // Cinematic shake — ramps up through the charge phase
    const shake = p === "waking" && phaseAge < 1.0
      ? (Math.random() - 0.5) * 0.06 * Math.pow(phaseAge / 1.0, 2)
      : 0;

    if (groupRef.current) {
      groupRef.current.rotation.y += rotSpeed * dt;
      groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.12;
      groupRef.current.position.x = shake;
      groupRef.current.position.y = shake * 0.7;
    }

    // Core: small faceted icosahedron — same as a brain node, just slightly bigger
    if (coreRef.current) {
      const s = 0.07 * breath * sizeMul;
      coreRef.current.scale.setScalar(s);
      const m = coreRef.current.material as THREE.MeshBasicMaterial;
      m.color.copy(GOLD_HI).lerp(WHITE, Math.min(1, (intensityMul - 1) * 0.4));
      m.opacity = opacityMul;
    }
    // Hot inner pinpoint — pure brightness, no second shape
    if (innerRef.current) {
      const s = 0.04 * breath * sizeMul * (1 + audio * 0.2);
      innerRef.current.scale.setScalar(s);
      const m = innerRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = opacityMul * Math.min(1.5, intensityMul);
    }

    // Particles
    let anyAlive = false;
    if (particles.current.length > 0) {
      for (let i = 0; i < POOL; i++) {
        const part = particles.current[i];
        if (!part) continue;
        if (part.life > 0) anyAlive = true;
        part.pos.addScaledVector(part.vel, dt);
        part.vel.multiplyScalar(0.955);
        part.life -= dt * 0.8;
        positions[i * 3] = part.pos.x;
        positions[i * 3 + 1] = part.pos.y;
        positions[i * 3 + 2] = part.pos.z;
        const life = Math.max(0, part.life);
        const c = GOLD.clone().lerp(WHITE, life * life);
        colorsArr[i * 3] = c.r;
        colorsArr[i * 3 + 1] = c.g;
        colorsArr[i * 3 + 2] = c.b;
      }
      (particleGeom.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (particleGeom.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    }
    if (particlesRef.current) {
      const m = particlesRef.current.material as THREE.PointsMaterial;
      m.opacity = anyAlive ? 1 : 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Faceted core — matches brain node geometry */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={GOLD_HI}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Hot pinpoint */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={"#ffffff"}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Burst particles — small, fast, many */}
      <points ref={particlesRef} geometry={particleGeom}>
        <pointsMaterial
          vertexColors
          size={0.025}
          transparent
          opacity={0}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

export function EnergyBall({ phase }: { phase: WakePhase }) {
  const showCanvas = phase === "sleeping" || phase === "waking" || phase === "sleeping-out";
  if (!showCanvas) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 60, background: "#000" }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "transparent" }}
      >
        <Bloom />
        <Starfield />
        <Orb phase={phase} />
      </Canvas>
    </div>
  );
}
