import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { useThree } from "@react-three/fiber";
import { getSpeakingIntensity } from "@/lib/brainEvents";
import { useWake } from "@/contexts/WakeContext";

const GOLD = new THREE.Color("#FFD36B");
const GOLD_HI = new THREE.Color("#FFE9A8");
const WHITE = new THREE.Color("#ffffff");

function Bloom() {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 1.6, 0.7, 0.05));
    composer.current = c;
    return () => c.dispose();
  }, [gl, scene, camera, size]);
  useFrame(() => composer.current?.render(), 1);
  return null;
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

function Orb() {
  const { phase } = useWake();
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
  const halo1Ref = useRef<THREE.Mesh>(null);
  const halo2Ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Particle system: bigger pool for cinematic burst
  const POOL = 220;
  const positions = useMemo(() => new Float32Array(POOL * 3), []);
  const colorsArr = useMemo(() => new Float32Array(POOL * 3), []);
  const sizesArr = useMemo(() => new Float32Array(POOL), []);
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
      const speed = 1.8 + Math.random() * 3.5;
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

    // Idle breathing — same rhythm as brain nodes
    const breath = 1 + Math.sin(t * 0.7) * 0.18 + audio * 0.3;

    // Phase-driven scale/intensity multipliers
    let sizeMul = 1;
    let intensityMul = 1;
    let rotSpeed = 0.35;
    let opacityMul = 1;

    if (p === "waking") {
      // Cinematic charge: 0..0.45s charge up (grow + shake + brighten),
      // 0.45..0.55s explode (snap small),
      // 0.55..1.6s fade
      const a = phaseAge;
      if (a < 0.45) {
        const k = a / 0.45;
        sizeMul = 1 + k * k * 1.6;          // accelerate growth
        intensityMul = 1 + k * 2.8;
        rotSpeed = 0.35 + k * 4;
        opacityMul = 1;
      } else if (a < 0.55) {
        sizeMul = 0.05;                      // imploded → about to burst out
        intensityMul = 4;
        opacityMul = 0.0;                    // hide core, particles take over
      } else {
        const k = Math.min(1, (a - 0.55) / 1.0);
        sizeMul = 0;
        opacityMul = Math.max(0, 1 - k);
      }
    } else if (p === "sleeping") {
      // Idle
    }

    // Apply tiny random shake during charge
    const shake = p === "waking" && phaseAge < 0.45
      ? (Math.random() - 0.5) * 0.03 * (phaseAge / 0.45)
      : 0;

    if (groupRef.current) {
      groupRef.current.rotation.y += rotSpeed * dt;
      groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.15;
      groupRef.current.position.x = shake;
      groupRef.current.position.y = shake * 0.7;
    }

    // Core (icosahedron, like a brain node but larger)
    if (coreRef.current) {
      const s = 0.13 * breath * sizeMul;
      coreRef.current.scale.setScalar(s);
      const m = coreRef.current.material as THREE.MeshBasicMaterial;
      m.color.copy(GOLD_HI).lerp(WHITE, Math.min(1, (intensityMul - 1) * 0.4));
      m.opacity = 1 * opacityMul;
    }
    if (innerRef.current) {
      const s = 0.07 * breath * sizeMul;
      innerRef.current.scale.setScalar(s);
      const m = innerRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 1 * opacityMul;
    }
    if (halo1Ref.current) {
      const s = 0.28 * breath * sizeMul * (1 + audio * 0.3);
      halo1Ref.current.scale.setScalar(s);
      const m = halo1Ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = (0.55 + audio * 0.3) * opacityMul * intensityMul * 0.5;
    }
    if (halo2Ref.current) {
      const s = 0.5 * breath * sizeMul * (1 + audio * 0.5);
      halo2Ref.current.scale.setScalar(s);
      const m = halo2Ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = (0.22 + audio * 0.25) * opacityMul * intensityMul * 0.5;
    }
    if (ringRef.current) {
      // Faint outer corona ring during charge
      const ringS = 0.7 * breath * sizeMul;
      ringRef.current.scale.setScalar(ringS);
      ringRef.current.rotation.z += dt * 0.4;
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (0.08 + (intensityMul - 1) * 0.12) * opacityMul;
    }

    // Particles
    let anyAlive = false;
    if (particles.current.length > 0) {
      for (let i = 0; i < POOL; i++) {
        const part = particles.current[i];
        if (!part) continue;
        if (part.life > 0) anyAlive = true;
        part.pos.addScaledVector(part.vel, dt);
        part.vel.multiplyScalar(0.965);
        part.life -= dt * 0.7;
        positions[i * 3] = part.pos.x;
        positions[i * 3 + 1] = part.pos.y;
        positions[i * 3 + 2] = part.pos.z;
        const life = Math.max(0, part.life);
        // color: white-hot core → gold tail
        const c = GOLD.clone().lerp(WHITE, life);
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
      {/* Outer ring corona (rare, charge-only really visible) */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.0, 64]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Outer halo */}
      <mesh ref={halo2Ref}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Inner halo */}
      <mesh ref={halo1Ref}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={GOLD_HI}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Core (faceted, like brain nodes) */}
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
      {/* Hot inner pinpoint */}
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
      {/* Burst particles */}
      <points ref={particlesRef} geometry={particleGeom}>
        <pointsMaterial
          vertexColors
          size={0.07}
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

export function EnergyBall() {
  const { phase } = useWake();
  // Canvas itself stays mounted whenever orb is needed.
  // Background is transparent so the existing star backdrop (CyberGlobe stars) shows
  // through during sleeping-out — making the suction feel continuous with the brain scene.
  const showCanvas = phase === "sleeping" || phase === "waking" || phase === "sleeping-out";
  if (!showCanvas) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 60 }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "transparent" }}
      >
        <Bloom />
        <Orb />
      </Canvas>
    </div>
  );
}
