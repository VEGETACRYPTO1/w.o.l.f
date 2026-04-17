import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { onBrainEvent, getSpeakingIntensity } from "@/lib/brainEvents";

const modeColors: Record<string, { highlight: string; mid: string; shadow: string }> = {
  intelligence: { highlight: "#FFD36B", mid: "#C6A75E", shadow: "#8C6B2E" },
  war: { highlight: "#FF3B3B", mid: "#CC2222", shadow: "#881111" },
  rebuild: { highlight: "#4090e0", mid: "#3070b0", shadow: "#205080" },
  expansion: { highlight: "#40b870", mid: "#309060", shadow: "#206040" },
  relax: { highlight: "#00ffcc", mid: "#00cc99", shadow: "#008866" },
};

type ModeColorSet = { highlight: string; mid: string; shadow: string };

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
      1.2, 0.55, 0.08
    );
    composer.addPass(bloom);
    composerRef.current = composer;
    return () => { composer.dispose(); };
  }, [gl, scene, camera, size]);

  useFrame(() => { composerRef.current?.render(); }, 1);
  return null;
}

// ── Unified brain-shaped node distribution (single connected mass) ──
function generateBrainNodes(count: number) {
  const nodes: THREE.Vector3[] = [];
  const a = 2.2, b = 1.6, c = 1.9;

  while (nodes.length < count) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 0.7 + Math.random() * 0.32;
    let x = a * r * Math.sin(v) * Math.cos(u);
    let y = b * r * Math.sin(v) * Math.sin(u);
    let z = c * r * Math.cos(v);

    // Surface bumps to give brain-like gyri without splitting hemispheres
    const bump =
      0.09 * Math.sin(4 * u + 3 * v) +
      0.06 * Math.sin(7 * v - 2 * u) +
      0.04 * Math.sin(5 * u * v);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    x += (x / len) * bump;
    y += (y / len) * bump;
    z += (z / len) * bump;

    nodes.push(new THREE.Vector3(x, y, z));
  }
  return nodes;
}

// ── Cursor → 3D ray hit on brain bounding ellipsoid ──
function CursorTracker({ onMove }: { onMove: (localPoint: THREE.Vector3 | null) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const { camera, gl } = useThree();

  useEffect(() => {
    const update = (cx: number, cy: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((cx - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((cy - rect.top) / rect.height) * 2 + 1;
    };
    const onMouse = (e: MouseEvent) => update(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) update(t.clientX, t.clientY);
    };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchstart", onTouch);
    };
  }, [gl]);

  useFrame(() => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(mouse.current, camera);
    const hits = raycaster.intersectObject(meshRef.current, false);
    if (hits.length > 0) {
      // Convert world hit point into the brain group's local space
      const local = meshRef.current.worldToLocal(hits[0].point.clone());
      onMove(local);
    } else {
      onMove(null);
    }
  });

  return (
    <mesh ref={meshRef} visible={false} scale={[2.4, 1.8, 2.1]}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

// ── Brain Neural Network ──
interface Pulse {
  id: number;
  edgeIdx: number;
  progress: number;
  speed: number;
  reverse: boolean; // if true, travels from edges[e][1] -> edges[e][0]
}

let pulseId = 0;

function BrainNetwork({ colors }: { colors: ModeColorSet }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeMeshRef = useRef<THREE.InstancedMesh>(null);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);

  const NODE_COUNT = 560;
  const MAX_EDGES_PER_NODE = 6;
  const NEIGHBOR_DIST = 0.48;
  const MAX_PULSES = 140;
  const HOVER_RADIUS = 0.9;
  const CORE_RADIUS = 0.9; // nodes within this distance from center are "core"

  const { nodes, edges, edgePositions, firingPhases, edgesByNode, coreNodes, outwardEdgeDir } = useMemo(() => {
    const nodes = generateBrainNodes(NODE_COUNT);

    const edges: [number, number][] = [];
    const edgeSet = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
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

    // Adjacency: for each node → list of edge indices
    const edgesByNode: number[][] = nodes.map(() => []);
    for (let e = 0; e < edges.length; e++) {
      edgesByNode[edges[e][0]].push(e);
      edgesByNode[edges[e][1]].push(e);
    }

    const firingPhases = new Float32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) firingPhases[i] = Math.random() * Math.PI * 2;

    // Core node indices (close to center) — pulses originate here
    const coreNodes: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].length() < CORE_RADIUS) coreNodes.push(i);
    }

    // Precompute outward direction for each edge: which endpoint is farther from center
    // outwardEdgeDir[e] = 1 if going from edges[e][0] -> edges[e][1] is outward, else 0 (reverse)
    const outwardEdgeDir = new Uint8Array(edges.length);
    for (let e = 0; e < edges.length; e++) {
      const [i, j] = edges[e];
      outwardEdgeDir[e] = nodes[j].length() >= nodes[i].length() ? 1 : 0;
    }

    return { nodes, edges, edgePositions, firingPhases, edgesByNode, coreNodes, outwardEdgeDir };
  }, []);

  const [pulses, setPulses] = useState<Pulse[]>([]);
  const nextSpawn = useRef(0);
  const nextFlash = useRef(0);
  const flashIndex = useRef<number>(-1);
  const flashUntil = useRef<number>(0);

  // Hover state in local brain space
  const hoverPoint = useRef<THREE.Vector3 | null>(null);
  const lastBurst = useRef(0);

  // Chat wave: origin point + start time
  const waveOrigin = useRef<THREE.Vector3 | null>(null);
  const waveStart = useRef(0);

  const handleHover = useCallback((local: THREE.Vector3 | null) => {
    hoverPoint.current = local;
  }, []);

  // Subscribe to brain wave events from chat — originate from a core node
  useEffect(() => {
    const off = onBrainEvent("wave", () => {
      const idx = coreNodes.length > 0
        ? coreNodes[Math.floor(Math.random() * coreNodes.length)]
        : Math.floor(Math.random() * nodes.length);
      waveOrigin.current = nodes[idx].clone();
      waveStart.current = performance.now() / 1000;
      const adj = edgesByNode[idx];
      const burst: Pulse[] = [];
      for (let k = 0; k < Math.min(adj.length, 8); k++) {
        const e = adj[k];
        // Reverse so pulse travels outward from this node
        const reverse = edges[e][0] !== idx;
        burst.push({
          id: pulseId++,
          edgeIdx: e,
          progress: 0,
          speed: 0.03 + Math.random() * 0.02,
          reverse,
        });
      }
      setPulses((prev) => [...prev, ...burst]);
    });
    return () => { off(); };
  }, [nodes, edgesByNode, coreNodes, edges]);

  const highlightColor = useMemo(() => new THREE.Color(colors.highlight), []);
  const midColor = useMemo(() => new THREE.Color(colors.mid), []);
  const shadowColor = useMemo(() => new THREE.Color(colors.shadow), []);
  const whiteColor = useMemo(() => new THREE.Color("#ffffff"), []);
  const targetHighlight = useRef(new THREE.Color(colors.highlight));
  const targetMid = useRef(new THREE.Color(colors.mid));
  const targetShadow = useRef(new THREE.Color(colors.shadow));

  useEffect(() => {
    targetHighlight.current.set(colors.highlight);
    targetMid.current.set(colors.mid);
    targetShadow.current.set(colors.shadow);
  }, [colors.highlight, colors.mid, colors.shadow]);

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

    highlightColor.lerp(targetHighlight.current, 0.04);
    midColor.lerp(targetMid.current, 0.04);
    shadowColor.lerp(targetShadow.current, 0.04);

    const audio = getSpeakingIntensity();
    // Heartbeat breathing: slower, deeper double-beat
    const heartbeat =
      Math.pow(Math.max(0, Math.sin(t * 0.45)), 2) * 0.22 +
      Math.pow(Math.max(0, Math.sin(t * 0.45 + 0.35)), 4) * 0.10;
    const breath = 0.92 + heartbeat + audio * 0.12;
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0012 + audio * 0.004;
      groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08;
      groupRef.current.scale.setScalar(breath);
    }

    // Wave propagation from chat events
    const waveAge = waveOrigin.current ? t - waveStart.current : -1;
    const waveRadius = waveAge >= 0 ? waveAge * 3.5 : -1;
    const waveActive = waveAge >= 0 && waveAge < 1.6;

    // White flash on a random node every so often
    if (t > nextFlash.current) {
      flashIndex.current = Math.floor(Math.random() * nodes.length);
      flashUntil.current = t + 0.25;
      nextFlash.current = t + 0.6 + Math.random() * 1.4;
    }
    const flashing = t < flashUntil.current ? flashIndex.current : -1;
    const flashStrength = flashing >= 0 ? Math.max(0, 1 - (t - (flashUntil.current - 0.25)) / 0.25) : 0;

    const hover = hoverPoint.current;

    // Update node firing
    if (nodeMeshRef.current) {
      for (let i = 0; i < nodes.length; i++) {
        const phase = firingPhases[i];
        let fire = Math.pow(Math.max(0, Math.sin(t * 1.2 + phase)), 8);

        // Audio-reactive boost
        if (audio > 0) {
          const audioFire = Math.pow(Math.max(0, Math.sin(t * 6 + phase * 2)), 4) * audio;
          fire = Math.min(1, fire + audioFire * 0.7);
        }

        // Hover proximity boost
        let proximity = 0;
        if (hover) {
          const d = nodes[i].distanceTo(hover);
          if (d < HOVER_RADIUS) {
            proximity = 1 - d / HOVER_RADIUS;
            fire = Math.min(1, fire + proximity * 0.9);
          }
        }

        // Wave ring boost
        let waveBoost = 0;
        if (waveActive && waveOrigin.current) {
          const d = nodes[i].distanceTo(waveOrigin.current);
          const ring = Math.abs(d - waveRadius);
          if (ring < 0.35) {
            waveBoost = (1 - ring / 0.35) * (1 - waveAge / 1.6);
            fire = Math.min(1, fire + waveBoost);
          }
        }

        const baseScale = 0.011;
        let scale = baseScale + fire * 0.05 + proximity * 0.025 + waveBoost * 0.04 + audio * 0.012;

        // Color: idle = mid, firing = highlight
        tmpColor.copy(midColor).lerp(highlightColor, fire);

        if (i === flashing) {
          tmpColor.lerp(whiteColor, flashStrength);
          scale += flashStrength * 0.08;
        }
        if (waveBoost > 0.3) tmpColor.lerp(whiteColor, waveBoost * 0.5);

        dummy.position.copy(nodes[i]);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        nodeMeshRef.current.setMatrixAt(i, dummy.matrix);
        nodeMeshRef.current.setColorAt(i, tmpColor);
      }
      nodeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (nodeMeshRef.current.instanceColor) nodeMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (lineMatRef.current) {
      lineMatRef.current.color.copy(shadowColor).lerp(midColor, 0.4);
      lineMatRef.current.opacity = 0.16 + Math.sin(t * 0.9) * 0.04;
    }

    // Spawn pulses (denser ambient firing, more during speech)
    if (t > nextSpawn.current && pulses.length < MAX_PULSES) {
      const newPulses: Pulse[] = [];
      const spawnCount = 2 + Math.floor(Math.random() * 4) + Math.floor(audio * 5);
      for (let k = 0; k < spawnCount; k++) {
        newPulses.push({
          id: pulseId++,
          edgeIdx: Math.floor(Math.random() * edges.length),
          progress: 0,
          speed: 0.012 + Math.random() * 0.02 + audio * 0.02,
        });
      }
      setPulses((prev) => [...prev, ...newPulses]);
      nextSpawn.current = t + 0.05 + Math.random() * 0.18 - audio * 0.1;
    }

    // Hover burst — find nearest node, fire pulses along its edges
    if (hover && t - lastBurst.current > 0.18 && pulses.length < MAX_PULSES) {
      let nearestIdx = -1;
      let nearestD = HOVER_RADIUS;
      for (let i = 0; i < nodes.length; i++) {
        const d = nodes[i].distanceTo(hover);
        if (d < nearestD) { nearestD = d; nearestIdx = i; }
      }
      if (nearestIdx >= 0) {
        const adj = edgesByNode[nearestIdx];
        const burst: Pulse[] = [];
        const burstSize = Math.min(adj.length, 6);
        for (let k = 0; k < burstSize; k++) {
          burst.push({
            id: pulseId++,
            edgeIdx: adj[k],
            progress: 0,
            speed: 0.025 + Math.random() * 0.02,
          });
        }
        setPulses((prev) => [...prev, ...burst]);
        lastBurst.current = t;
      }
    }

    setPulses((prev) =>
      prev
        .map((p) => ({ ...p, progress: p.progress + p.speed }))
        .filter((p) => p.progress <= 1)
    );
  });

  return (
    <group ref={groupRef}>
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
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

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
            <sphereGeometry args={[0.028, 8, 8]} />
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

      <CursorTracker onMove={handleHover} />
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

// ── Parallax camera drift based on mouse ──
function ParallaxCamera() {
  const { camera, gl } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      target.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      target.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [gl]);

  useFrame(() => {
    const desiredX = target.current.x * 0.6;
    const desiredY = target.current.y * 0.4;
    camera.position.x += (desiredX - camera.position.x) * 0.04;
    camera.position.y += (desiredY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Scene({ colors }: { colors: ModeColorSet }) {
  return (
    <>
      <color attach="background" args={["#050507"]} />
      <BloomEffect />
      <ParallaxCamera />
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
