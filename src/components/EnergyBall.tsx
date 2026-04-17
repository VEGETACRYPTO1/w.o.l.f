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
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 1.6, 0.55, 0.05));
    composer.current = c;
    return () => c.dispose();
  }, [gl, scene, camera, size]);
  useFrame(() => composer.current?.render(), 1);
  return null;
}

function Starfield() {
  const ref = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const COUNT = 350;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 8 + Math.random() * 6;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 4;
    }
    return { positions };
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
  angle: number;
  radius: number;
  spiraling: boolean;
  // target position on orb surface (for sleep)
  targetPos: THREE.Vector3;
  startPos: THREE.Vector3;
}

function Orb({ phase }: { phase: WakePhase }) {
  const phaseRef = useRef(phase);
  const phaseStartRef = useRef(performance.now() / 1000);

  useEffect(() => {
    phaseRef.current = phase;
    phaseStartRef.current = performance.now() / 1000;
    if (phase === "waking") triggerBurst();
    if (phase === "sleeping-out") triggerSuck();
  }, [phase]);

  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

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
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const speed = 2.5 + Math.random() * 4.5;
      arr.push({
        pos: new THREE.Vector3(0, 0, 0),
        vel: dir.multiplyScalar(speed),
        life: 1,
        angle: 0,
        radius: 0,
        spiraling: false,
        targetPos: new THREE.Vector3(),
        startPos: new THREE.Vector3(),
      });
    }
    particles.current = arr;
  };

  // Particles start scattered and spiral inward, then FORM the orb shape
  const triggerSuck = () => {
    const arr: Particle[] = [];
    for (let i = 0; i < POOL; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 3.5;
      const startPos = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 2);

      // Target: point on orb surface sphere
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const orbR = 0.12;
      const targetPos = new THREE.Vector3(
        orbR * Math.sin(phi) * Math.cos(theta),
        orbR * Math.sin(phi) * Math.sin(theta),
        orbR * Math.cos(phi),
      );

      arr.push({
        pos: startPos.clone(),
        vel: new THREE.Vector3(0, 0, 0),
        life: 1,
        angle,
        radius,
        spiraling: true,
        targetPos,
        startPos: startPos.clone(),
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
    const breath = 1 + Math.sin(t * 0.7) * 0.15 + audio * 0.25;

    let sizeMul = 1;
    let intensityMul = 1;
    let rotSpeed = 0.3;
    let opacityMul = 1;
    let showOrb = true;

    if (p === "waking") {
      const a = phaseAge;
      if (a < 1.0) {
        const k = a / 1.0;
        const eased = k * k;
        sizeMul = 1 - eased * 0.45;
        intensityMul = 1 + eased * 4.5;
        rotSpeed = 0.3 + eased * 8;
        opacityMul = 1;
      } else if (a < 1.15) {
        sizeMul = 0.0;
        intensityMul = 6;
        opacityMul = 0;
      } else {
        const k = Math.min(1, (a - 1.15) / 1.8);
        sizeMul = 0;
        opacityMul = Math.max(0, 1 - k);
      }
    }

    // Sleep: hide orb mesh, particles form the orb shape
    if (p === "sleeping-out") {
      showOrb = false;
      opacityMul = 0;
    }

    const shake = p === "waking" && phaseAge < 1.0 ? (Math.random() - 0.5) * 0.06 * Math.pow(phaseAge / 1.0, 2) : 0;

    if (groupRef.current) {
      groupRef.current.rotation.y += rotSpeed * dt;
      groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.12;
      groupRef.current.position.x = shake;
      groupRef.current.position.y = shake * 0.7;
    }

    if (coreRef.current) {
      const s = showOrb ? 0.07 * breath * sizeMul : 0;
      coreRef.current.scale.setScalar(s);
      const m = coreRef.current.material as THREE.MeshBasicMaterial;
      m.color.copy(GOLD_HI).lerp(WHITE, Math.min(1, (intensityMul - 1) * 0.4));
      m.opacity = opacityMul;
    }
    if (innerRef.current) {
      const s = showOrb ? 0.04 * breath * sizeMul * (1 + audio * 0.2) : 0;
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

        if (part.spiraling) {
          // Phase 1 (0-1.4s): spiral inward
          // Phase 2 (1.4-2.8s): particles on orb surface, slowly orbiting
          const SPIRAL_PHASE = 1.4;
          const ORB_PHASE = 2.8;

          if (phaseAge < SPIRAL_PHASE) {
            // Spiral inward with rotation
            const progress = phaseAge / SPIRAL_PHASE;
            const eased = progress * progress;
            part.angle += dt * (1.5 + eased * 10);
            part.radius *= 1 - dt * (0.3 + eased * 1.8);
            part.pos.x = Math.cos(part.angle) * part.radius;
            part.pos.y = Math.sin(part.angle) * part.radius * 0.6;
            part.pos.z *= 1 - dt * 2;
            part.life = 1;
          } else if (phaseAge < ORB_PHASE) {
            // Particles arrive at orb surface — lerp to target
            const progress = (phaseAge - SPIRAL_PHASE) / (ORB_PHASE - SPIRAL_PHASE);
            const eased = 1 - Math.pow(1 - progress, 3);
            part.pos.lerpVectors(
              new THREE.Vector3(
                Math.cos(part.angle) * Math.max(part.radius, 0.01),
                Math.sin(part.angle) * Math.max(part.radius, 0.01) * 0.6,
                part.pos.z,
              ),
              part.targetPos,
              eased * dt * 3,
            );
            // Slow orbit on surface
            part.angle += dt * 0.5;
            part.life = 1;
          } else {
            part.life = 0;
          }
        } else {
          part.pos.addScaledVector(part.vel, dt);
          part.vel.multiplyScalar(0.955);
          part.life -= dt * 0.8;
        }

        if (part.life > 0) anyAlive = true;
        positions[i * 3] = part.pos.x;
        positions[i * 3 + 1] = part.pos.y;
        positions[i * 3 + 2] = part.pos.z;
        const life = Math.max(0, part.life);
        const c = GOLD.clone().lerp(WHITE, life * 0.3);
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

  const isStableSleep = phase === "sleeping";
  const isSleepingOut = phase === "sleeping-out";

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 60,
        background: isStableSleep ? "#000" : isSleepingOut ? "rgba(0,0,0,0.85)" : "transparent",
        transition: "background 0.8s ease",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "transparent" }}
      >
        <Bloom />
        {(isStableSleep || isSleepingOut) && <Starfield />}
        <Orb phase={phase} />
      </Canvas>
    </div>
  );
}
