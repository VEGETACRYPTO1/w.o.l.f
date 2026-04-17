import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { useWake } from "@/contexts/WakeContext";
import { getSpeakingIntensity } from "@/lib/brainEvents";

const MODE_COLORS: Record<string, string> = {
  intelligence: "#FFD36B",
  war: "#FF3B3B",
  relax: "#00ffcc",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

function Orb({ color, phase }: { color: string; phase: "idle" | "burst" | "implode" }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Points>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const targetColor = useMemo(() => new THREE.Color(color), []);
  const currentColor = useMemo(() => new THREE.Color(color), []);
  const phaseStart = useRef<number>(performance.now() / 1000);
  const lastPhase = useRef(phase);

  useEffect(() => {
    targetColor.set(color);
  }, [color]);

  useEffect(() => {
    if (lastPhase.current !== phase) {
      phaseStart.current = performance.now() / 1000;
      lastPhase.current = phase;
    }
  }, [phase]);

  // halo particle positions
  const PARTICLES = 220;
  const haloGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLES * 3);
    const radii = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      const r = 0.55 + Math.random() * 0.25;
      pos[i * 3] = r * Math.sin(v) * Math.cos(u);
      pos[i * 3 + 1] = r * Math.sin(v) * Math.sin(u);
      pos[i * 3 + 2] = r * Math.cos(v);
      radii[i] = r;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    (g as any)._baseRadii = radii;
    return g;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const audio = getSpeakingIntensity();
    const breath = 1 + Math.sin(t * 0.9) * 0.12 + audio * 0.25;
    const age = t - phaseStart.current;

    currentColor.lerp(targetColor, 0.05);

    let scaleMul = 1;
    let opacityMul = 1;

    if (phase === "burst") {
      // 0..0.7s expand, fade
      const k = Math.min(1, age / 0.7);
      scaleMul = 1 + k * 2.5;
      opacityMul = 1 - k;
    } else if (phase === "implode") {
      // bright pulse
      const k = Math.min(1, age / 0.6);
      scaleMul = 1 + Math.sin(k * Math.PI) * 0.6;
      opacityMul = 1;
    }

    if (coreRef.current) {
      coreRef.current.scale.setScalar(breath * scaleMul);
      coreRef.current.rotation.y += 0.004;
      coreRef.current.rotation.x += 0.002;
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(currentColor);
      mat.opacity = 0.9 * opacityMul;
    }
    if (innerRef.current) {
      innerRef.current.scale.setScalar(breath * scaleMul * 0.6);
      const mat = innerRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(currentColor);
      mat.opacity = 1 * opacityMul;
    }
    if (haloRef.current) {
      haloRef.current.rotation.y -= 0.002;
      haloRef.current.rotation.z += 0.001;
      // burst expands halo
      const haloScale = breath * scaleMul * (phase === "burst" ? 1 + age * 1.2 : 1);
      haloRef.current.scale.setScalar(haloScale);
      const mat = haloRef.current.material as THREE.PointsMaterial;
      mat.color.copy(currentColor);
      mat.opacity = 0.7 * opacityMul;
    }
  });

  return (
    <group>
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <points ref={haloRef} geometry={haloGeom}>
        <pointsMaterial color={color} size={0.04} transparent opacity={0.7} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

export function EnergyBall() {
  const { mode } = useMode();
  const { awake, transitioning } = useWake();
  const color = MODE_COLORS[mode] || MODE_COLORS.intelligence;

  // Determine visual phase
  const phase: "idle" | "burst" | "implode" =
    transitioning === "waking" ? "burst" : transitioning === "sleeping" ? "implode" : "idle";

  // Visibility: visible when not awake OR when transitioning
  const visible = !awake || transitioning !== null;
  const fadingOut = awake && transitioning !== "sleeping";

  return (
    <div
      className="fixed inset-0 pointer-events-none transition-opacity duration-700"
      style={{
        zIndex: 60,
        opacity: visible && !fadingOut ? 1 : 0,
      }}
      aria-hidden
    >
      <Canvas camera={{ position: [0, 0, 3], fov: 60 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <Orb color={color} phase={phase} />
      </Canvas>
    </div>
  );
}
