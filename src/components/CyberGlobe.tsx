import { useRef, useMemo, useState, useCallback, createContext, useContext } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { useEffect } from "react";

const modeColors: Record<string, { highlight: string; mid: string; shadow: string }> = {
  intelligence: { highlight: "#FFD36B", mid: "#C6A75E", shadow: "#8C6B2E" },
  war: { highlight: "#FF3B3B", mid: "#CC2222", shadow: "#881111" },
  rebuild: { highlight: "#4090e0", mid: "#3070b0", shadow: "#205080" },
  expansion: { highlight: "#40b870", mid: "#309060", shadow: "#206040" },
  relax: { highlight: "#00ffcc", mid: "#00cc99", shadow: "#008866" },
};

// Global reset trigger
let resetTrigger = 0;
const resetListeners: Set<() => void> = new Set();

export function resetSphere() {
  resetTrigger++;
  resetListeners.forEach((fn) => fn());
}

// ── Bloom ──
function BloomEffect() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.75, 0.4, 0.15
    );
    composer.addPass(bloom);
    composerRef.current = composer;
    return () => { composer.dispose(); };
  }, [gl, scene, camera, size]);

  useFrame(() => { composerRef.current?.render(); }, 1);
  return null;
}

// ── Invisible hit sphere for raycasting ──
function HitSphere({ onHit }: { onHit: (hovering: boolean, point: THREE.Vector3 | null) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const { camera, gl } = useThree();

  useEffect(() => {
    const updatePointer = (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) updatePointer(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchstart", onTouch);
    };
  }, [gl]);

  useFrame(() => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(mouse.current, camera);
    const intersects = raycaster.intersectObject(meshRef.current, false);

    if (intersects.length > 0) {
      onHit(true, intersects[0].point.clone());
    } else {
      onHit(false, null);
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

type ModeColorSet = { highlight: string; mid: string; shadow: string };

function ParticleSphere({ colors }: { colors: ModeColorSet }) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = 4000;
  const radius = 2;
  const originalPositions = useRef<Float32Array | null>(null);
  const hitState = useRef<{ hovering: boolean; point: THREE.Vector3 | null }>({ hovering: false, point: null });
  // Store per-particle color tier (0=highlight, 1=mid, 2=shadow) — stable across mode changes
  const colorTiers = useRef<Uint8Array | null>(null);

  // Generate positions and color tiers ONCE
  const { positions, colorArray, offsets } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const offs = new Float32Array(count);
    const tiers = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      const r = Math.random();
      tiers[i] = r < 0.2 ? 0 : r < 0.8 ? 1 : 2;
      offs[i] = Math.random() * Math.PI * 2;
    }
    colorTiers.current = tiers;
    originalPositions.current = pos.slice();
    return { positions: pos, colorArray: col, offsets: offs };
  }, []); // positions generated once, never reset

  // Target colors (what we're lerping toward)
  const targetColors = useRef({ highlight: new THREE.Color(colors.highlight), mid: new THREE.Color(colors.mid), shadow: new THREE.Color(colors.shadow) });
  // Current interpolated colors
  const currentColors = useRef({ highlight: new THREE.Color(colors.highlight), mid: new THREE.Color(colors.mid), shadow: new THREE.Color(colors.shadow) });

  // Update targets when mode changes
  useEffect(() => {
    targetColors.current.highlight.set(colors.highlight);
    targetColors.current.mid.set(colors.mid);
    targetColors.current.shadow.set(colors.shadow);
  }, [colors.highlight, colors.mid, colors.shadow]);

  const lerpSpeed = 0.04; // smooth transition speed

  // Lerp colors every frame
  const applyColors = useCallback(() => {
    if (!ref.current || !colorTiers.current) return;
    const col = (ref.current.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    const tiers = colorTiers.current;
    const cur = currentColors.current;
    const tgt = targetColors.current;

    // Lerp current toward target
    cur.highlight.lerp(tgt.highlight, lerpSpeed);
    cur.mid.lerp(tgt.mid, lerpSpeed);
    cur.shadow.lerp(tgt.shadow, lerpSpeed);

    for (let i = 0; i < count; i++) {
      const tc = tiers[i] === 0 ? cur.highlight : tiers[i] === 1 ? cur.mid : cur.shadow;
      col[i * 3] = tc.r;
      col[i * 3 + 1] = tc.g;
      col[i * 3 + 2] = tc.b;
    }
    ref.current.geometry.attributes.color.needsUpdate = true;
  }, [count]);

  const doReset = useCallback(() => {
    if (!ref.current || !originalPositions.current) return;
    const pos = (ref.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const orig = originalPositions.current;
    for (let i = 0; i < pos.length; i++) pos[i] = orig[i];
    ref.current.geometry.attributes.position.needsUpdate = true;
  }, []);

  useEffect(() => {
    resetListeners.add(doReset);
    return () => { resetListeners.delete(doReset); };
  }, [doReset]);

  const handleHit = useCallback((hovering: boolean, point: THREE.Vector3 | null) => {
    hitState.current.hovering = hovering;
    hitState.current.point = point;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!ref.current || !originalPositions.current) return;

    // Force-update particle colors every frame
    applyColors();

    const geometry = ref.current.geometry;
    const pos = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const orig = originalPositions.current;
    const { hovering, point } = hitState.current;

    let localHit: THREE.Vector3 | null = null;
    if (hovering && point) {
      localHit = ref.current.worldToLocal(point.clone());
    }

    for (let i = 0; i < pos.length; i += 3) {
      const ox = orig[i], oy = orig[i + 1], oz = orig[i + 2];
      let nx = ox, ny = oy, nz = oz;

      if (hovering && localHit) {
        const dot = ox * localHit.x + oy * localHit.y + oz * localHit.z;
        if (dot > 0) {
          const dx = ox - localHit.x, dy = oy - localHit.y, dz = oz - localHit.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.0001;
          const interactionRadius = 0.7, strength = 0.5;
          if (dist < interactionRadius) {
            const falloff = 1 - dist / interactionRadius;
            const force = falloff * strength;
            nx += (dx / dist) * force;
            ny += (dy / dist) * force;
            nz += (dz / dist) * force;
          }
        }
      }

      pos[i] += (nx - pos[i]) * 0.15;
      pos[i + 1] += (ny - pos[i + 1]) * 0.15;
      pos[i + 2] += (nz - pos[i + 2]) * 0.15;
    }

    geometry.attributes.position.needsUpdate = true;
    ref.current.rotation.y += 0.0015;
    ref.current.rotation.x += 0.0005;
    ref.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.12);

    if (matRef.current) {
      matRef.current.opacity = 0.65 + Math.sin(t * 0.7) * 0.12;
    }
  });

  return (
    <>
      <HitSphere onHit={handleHit} />
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={count} array={colorArray} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          vertexColors
          size={0.015}
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
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
function Scene({ colors }: { colors: ModeColorSet }) {
  return (
    <>
      <color attach="background" args={["#050507"]} />
      <BloomEffect />
      <ParticleSphere colors={colors} />
      <ConnectionLines color={colors.mid} />
      <NeuronSignals color={colors.highlight} />
      <BackgroundStars />
    </>
  );
}

export function CyberGlobe() {
  const { mode } = useMode();
  const colors = modeColors[mode] || modeColors.intelligence;

  return (
    <div className="fixed inset-0" style={{ zIndex: 0, filter: "contrast(1.1)" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "#050507" }}
      >
        <Scene colors={colors} />
      </Canvas>
    </div>
  );
}
