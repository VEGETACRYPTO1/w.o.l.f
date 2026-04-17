import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const modeColors: Record<string, { highlight: string; mid: string; shadow: string }> = {
  intelligence: { highlight: "#FFD36B", mid: "#C6A75E", shadow: "#8C6B2E" },
  war: { highlight: "#FF3B3B", mid: "#CC2222", shadow: "#881111" },
  rebuild: { highlight: "#4090e0", mid: "#3070b0", shadow: "#205080" },
  expansion: { highlight: "#40b870", mid: "#309060", shadow: "#206040" },
  relax: { highlight: "#00ffcc", mid: "#00cc99", shadow: "#008866" },
};

type ModeColorSet = { highlight: string; mid: string; shadow: string };

// Reset hook (kept for compatibility with any external callers)
const resetListeners: Set<() => void> = new Set();
export function resetSphere() {
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
      1.1, 0.5, 0.1
    );
    composer.addPass(bloom);
    composerRef.current = composer;
    return () => { composer.dispose(); };
  }, [gl, scene, camera, size]);

  useFrame(() => { composerRef.current?.render(); }, 1);
  return null;
}

// ── Brain-shaped node distribution ──
// Two hemispheres (left/right), ellipsoidal, with a slight central fissure.
function generateBrainNodes(count: number) {
  const nodes: THREE.Vector3[] = [];
  // Brain ellipsoid radii
  const a = 2.2; // x (width)
  const b = 1.6; // y (height)
  const c = 1.9; // z (depth)
  const fissure = 0.18; // central gap along x

  while (nodes.length < count) {
    // Sample inside ellipsoid surface band
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    // Surface + slight inward jitter for organic depth
    const r = 0.85 + Math.random() * 0.18;
    let x = a * r * Math.sin(v) * Math.cos(u);
    const y = b * r * Math.sin(v) * Math.sin(u);
    const z = c * r * Math.cos(v);

    // Push hemispheres apart along x to create the central fissure
    if (Math.abs(x) < fissure) continue;
    x += Math.sign(x) * 0.05;

    // Add bumpy "gyri" using noise-like sin perturbation
    const bump =
      0.08 * Math.sin(4 * u + 3 * v) +
      0.05 * Math.sin(7 * v - 2 * u);
    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x + (x / len) * bump;
    const ny = y + (y / len) * bump;
    const nz = z + (z / len) * bump;

    nodes.push(new THREE.Vector3(nx, ny, nz));
  }
  return nodes;
}

// ── Brain Neural Network ──
interface Pulse {
  id: number;
  edgeIdx: number;
  progress: number;
  speed: number;
}

let pulseId = 0;

function BrainNetwork({ colors }: { colors: ModeColorSet }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeMeshRef = useRef<THREE.InstancedMesh>(null);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const pulseGroupRef = useRef<THREE.Group>(null);

  const NODE_COUNT = 280;
  const MAX_EDGES_PER_NODE = 4;
  const NEIGHBOR_DIST = 0.55;
  const MAX_PULSES = 40;

  // Generate brain nodes once
  const { nodes, edges, edgePositions, firingPhases } = useMemo(() => {
    const nodes = generateBrainNodes(NODE_COUNT);

    // Build edges: connect each node to nearest few neighbors within radius
    const edges: [number, number][] = [];
    const edgeSet = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      // Find candidate neighbors
      const candidates: { j: number; d: number }[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = nodes[i].distanceTo(nodes[j]);
        if (d < NEIGHBOR_DIST) candidates.push({ j, d });
      }
      candidates.sort((p, q) => p.d - q.d);
      const take = Math.min(MAX_EDGES_PER_NODE, candidates.length);
      for (let k = 0; k < take; k++) {
        const j = candidates[k].j;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([i, j]);
        }
      }
    }

    // Build flat positions array for line segments
    const edgePositions = new Float32Array(edges.length * 2 * 3);
    for (let e = 0; e < edges.length; e++) {
      const [i, j] = edges[e];
      const a = nodes[i], b = nodes[j];
      edgePositions[e * 6 + 0] = a.x;
      edgePositions[e * 6 + 1] = a.y;
      edgePositions[e * 6 + 2] = a.z;
      edgePositions[e * 6 + 3] = b.x;
      edgePositions[e * 6 + 4] = b.y;
      edgePositions[e * 6 + 5] = b.z;
    }

    // Per-node firing phase offset (random)
    const firingPhases = new Float32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) firingPhases[i] = Math.random() * Math.PI * 2;

    return { nodes, edges, edgePositions, firingPhases };
  }, []);

  // Pulses traveling along edges
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const nextSpawn = useRef(0);

  // Color objects
  const highlightColor = useMemo(() => new THREE.Color(colors.highlight), []);
  const midColor = useMemo(() => new THREE.Color(colors.mid), []);
  const shadowColor = useMemo(() => new THREE.Color(colors.shadow), []);
  const targetHighlight = useRef(new THREE.Color(colors.highlight));
  const targetMid = useRef(new THREE.Color(colors.mid));
  const targetShadow = useRef(new THREE.Color(colors.shadow));

  useEffect(() => {
    targetHighlight.current.set(colors.highlight);
    targetMid.current.set(colors.mid);
    targetShadow.current.set(colors.shadow);
  }, [colors.highlight, colors.mid, colors.shadow]);

  // Set up instanced node mesh transforms once
  useEffect(() => {
    if (!nodeMeshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < nodes.length; i++) {
      dummy.position.copy(nodes[i]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      nodeMeshRef.current.setMatrixAt(i, dummy.matrix);
      nodeMeshRef.current.setColorAt(i, midColor);
    }
    nodeMeshRef.current.instanceMatrix.needsUpdate = true;
    if (nodeMeshRef.current.instanceColor) nodeMeshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, midColor]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Lerp colors smoothly toward target
    highlightColor.lerp(targetHighlight.current, 0.04);
    midColor.lerp(targetMid.current, 0.04);
    shadowColor.lerp(targetShadow.current, 0.04);

    // Breathing scale
    const breath = 1 + Math.sin(t * 0.7) * 0.04;
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0012;
      groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08;
      groupRef.current.scale.setScalar(breath);
    }

    // Update node firing (pulse + brightness)
    if (nodeMeshRef.current) {
      for (let i = 0; i < nodes.length; i++) {
        const phase = firingPhases[i];
        // Random firing — sharp peaks
        const fire = Math.pow(Math.max(0, Math.sin(t * 1.2 + phase)), 8);
        const baseScale = 0.012;
        const scale = baseScale + fire * 0.045;
        dummy.position.copy(nodes[i]);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        nodeMeshRef.current.setMatrixAt(i, dummy.matrix);

        // Color: idle = mid, firing = highlight
        tmpColor.copy(midColor).lerp(highlightColor, fire);
        nodeMeshRef.current.setColorAt(i, tmpColor);
      }
      nodeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (nodeMeshRef.current.instanceColor) nodeMeshRef.current.instanceColor.needsUpdate = true;
    }

    // Edge color breathes subtly
    if (lineMatRef.current) {
      lineMatRef.current.color.copy(shadowColor).lerp(midColor, 0.4);
      lineMatRef.current.opacity = 0.18 + Math.sin(t * 0.9) * 0.05;
    }

    // Spawn new pulses
    if (t > nextSpawn.current && pulses.length < MAX_PULSES) {
      const newPulses: Pulse[] = [];
      const spawnCount = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < spawnCount; k++) {
        newPulses.push({
          id: pulseId++,
          edgeIdx: Math.floor(Math.random() * edges.length),
          progress: 0,
          speed: 0.012 + Math.random() * 0.018,
        });
      }
      setPulses((prev) => [...prev, ...newPulses]);
      nextSpawn.current = t + 0.08 + Math.random() * 0.25;
    }

    // Advance pulses
    setPulses((prev) =>
      prev
        .map((p) => ({ ...p, progress: p.progress + p.speed }))
        .filter((p) => p.progress <= 1)
    );
  });

  return (
    <group ref={groupRef}>
      {/* Synaptic connections */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={edgePositions.length / 3}
            array={edgePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lineMatRef}
          color={colors.mid}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Neuron nodes (instanced) */}
      <instancedMesh
        ref={nodeMeshRef}
        args={[undefined, undefined, NODE_COUNT]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Electric pulses traveling along edges */}
      <group ref={pulseGroupRef}>
        {pulses.map((p) => {
          const [i, j] = edges[p.edgeIdx];
          const a = nodes[i];
          const b = nodes[j];
          const x = a.x + (b.x - a.x) * p.progress;
          const y = a.y + (b.y - a.y) * p.progress;
          const z = a.z + (b.z - a.z) * p.progress;
          const intensity = Math.sin(p.progress * Math.PI);
          return (
            <mesh key={p.id} position={[x, y, z]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial
                color={colors.highlight}
                transparent
                opacity={intensity}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      </group>
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
      <BrainNetwork colors={colors} />
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
        camera={{ position: [0, 0, 5.5], fov: 70 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "#050507" }}
      >
        <Scene colors={colors} />
      </Canvas>
    </div>
  );
}
