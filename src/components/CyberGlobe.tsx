import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useMode } from "@/contexts/ModeContext";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { onBrainEvent, getSpeakingIntensity, onModeBurst } from "@/lib/brainEvents";

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
  toNode: number; // node index the pulse is traveling TOWARD
  generation: number; // 0 = ambient, increments each chain
}

let pulseId = 0;

function BrainNetwork({ colors }: { colors: ModeColorSet }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeMeshRef = useRef<THREE.InstancedMesh>(null);
  const lineGeomRef = useRef<THREE.BufferGeometry>(null);

  const NODE_COUNT = 560;
  const MAX_EDGES_PER_NODE = 6;
  const NEIGHBOR_DIST = 0.48;
  const MAX_PULSES = 90;
  const HOVER_RADIUS = 0.9;
  const TRAIL_DECAY = 1.6; // higher = faster fade

  const { nodes, edges, edgePositions, edgeColors, firingPhases, edgesByNode } = useMemo(() => {
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

    const edgeColors = new Float32Array(edges.length * 2 * 3);
    return { nodes, edges, edgePositions, edgeColors, firingPhases, edgesByNode };
  }, []);

  // Per-edge trail glow intensity (0..1), decays over time
  const edgeGlow = useMemo(() => new Float32Array(edges.length), [edges.length]);

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

  // Mode burst: radial shockwave from center
  const burstStart = useRef(0);
  const burstActive = useRef(false);
  const burstColor = useRef(new THREE.Color("#FFD36B"));
  const BURST_DURATION = 1.4;
  const BURST_MAX_RADIUS = 3.2;
  const BURST_BAND = 0.45;

  const handleHover = useCallback((local: THREE.Vector3 | null) => {
    hoverPoint.current = local;
  }, []);

  // Subscribe to brain wave events from chat
  useEffect(() => {
    const off = onBrainEvent("wave", () => {
      const idx = Math.floor(Math.random() * nodes.length);
      waveOrigin.current = nodes[idx].clone();
      waveStart.current = performance.now() / 1000;
      const adj = edgesByNode[idx];
      const burst: Pulse[] = [];
      for (let k = 0; k < Math.min(adj.length, 8); k++) {
        const edgeIdx = adj[k];
        const [ei, ej] = edges[edgeIdx];
        burst.push({
          id: pulseId++,
          edgeIdx,
          progress: 0,
          speed: 0.03 + Math.random() * 0.02,
          toNode: ei === idx ? ej : ei,
          generation: 0,
        });
      }
      setPulses((prev) => [...prev, ...burst]);
    });
    return () => { off(); };
  }, [nodes, edgesByNode]);

  // Subscribe to mode burst — radial shockwave from center
  useEffect(() => {
    const off = onModeBurst((color) => {
      console.log("💥 BURST", color);
      burstColor.current.set(color);
      burstStart.current = performance.now() / 1000;
      burstActive.current = true;
      // Spawn pulses from the most-central nodes outward
      const centerNodes = nodes
        .map((n, i) => ({ i, d: n.length() }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 10);
      const burst: Pulse[] = [];
      for (const { i: idx } of centerNodes) {
        const adj = edgesByNode[idx];
        if (!adj || adj.length === 0) continue;
        for (let k = 0; k < Math.min(adj.length, 3); k++) {
          const edgeIdx = adj[k];
          if (edgeIdx == null || !edges[edgeIdx]) continue;
          const [ei, ej] = edges[edgeIdx];
          const toNode = ei === idx ? ej : ei;
          // Pick the outward-facing direction
          burst.push({
            id: pulseId++,
            edgeIdx,
            progress: 0,
            speed: 0.025 + Math.random() * 0.02,
            toNode,
            generation: 0,
          });
        }
      }
      setPulses((prev) => [...prev, ...burst]);
    });
    return () => { off(); };
  }, [nodes, edges, edgesByNode]);

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
    // Smooth single-flow breathing — bigger amplitude
    const breath = 1 + Math.sin(t * 0.7) * 0.22 + audio * 0.08;
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0012 + audio * 0.004;
      groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08;
      groupRef.current.scale.setScalar(breath);
    }

    // Wave propagation from chat events
    const waveAge = waveOrigin.current ? t - waveStart.current : -1;
    const waveRadius = waveAge >= 0 ? waveAge * 3.5 : -1;
    const waveActive = waveAge >= 0 && waveAge < 1.6;

    // Mode burst: radial shockwave from center
    const burstAge = burstActive.current ? t - burstStart.current : -1;
    const burstProgress = burstAge >= 0 ? burstAge / BURST_DURATION : -1;
    const burstOn = burstActive.current && burstProgress >= 0 && burstProgress < 1;
    const burstRadius = burstOn ? burstProgress * BURST_MAX_RADIUS : -1;
    if (burstActive.current && burstProgress >= 1) burstActive.current = false;

    // Bump edges within wavefront band
    if (burstOn) {
      const fade = 1 - burstProgress;
      for (let e = 0; e < edges.length; e++) {
        const [i, j] = edges[e];
        const mx = (nodes[i].x + nodes[j].x) * 0.5;
        const my = (nodes[i].y + nodes[j].y) * 0.5;
        const mz = (nodes[i].z + nodes[j].z) * 0.5;
        const d = Math.sqrt(mx * mx + my * my + mz * mz);
        const ring = Math.abs(d - burstRadius);
        if (ring < BURST_BAND) {
          const k = (1 - ring / BURST_BAND) * fade;
          if (edgeGlow[e] < k) edgeGlow[e] = k;
        }
      }
    }


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

    // Decay all edge glows + write vertex colors
    const dt = Math.min(0.05, clock.getDelta?.() ?? 1 / 60);
    // Note: getDelta is on the clock; use its native API safely
    const decay = Math.exp(-TRAIL_DECAY * (1 / 60));
    const baseR = shadowColor.r * 0.6 + midColor.r * 0.2;
    const baseG = shadowColor.g * 0.6 + midColor.g * 0.2;
    const baseB = shadowColor.b * 0.6 + midColor.b * 0.2;
    // Highlight color tint: blend toward burst color while burst is active
    const tintAmt = burstOn ? Math.sin(burstProgress * Math.PI) : 0;
    const hiR = highlightColor.r + (burstColor.current.r - highlightColor.r) * tintAmt;
    const hiG = highlightColor.g + (burstColor.current.g - highlightColor.g) * tintAmt;
    const hiB = highlightColor.b + (burstColor.current.b - highlightColor.b) * tintAmt;
    if (lineGeomRef.current) {
      const colorAttr = lineGeomRef.current.getAttribute("color") as THREE.BufferAttribute | undefined;
      if (colorAttr) {
        const arr = colorAttr.array as Float32Array;
        for (let e = 0; e < edges.length; e++) {
          edgeGlow[e] *= decay;
          const g = edgeGlow[e];
          // Lift base brightness slightly with heartbeat
          const ambient = 0.55 + (breath - 1) * 0.6;
          const r = baseR * ambient + (hiR - baseR * ambient) * g;
          const gg = baseG * ambient + (hiG - baseG * ambient) * g;
          const b = baseB * ambient + (hiB - baseB * ambient) * g;
          arr[e * 6 + 0] = r; arr[e * 6 + 1] = gg; arr[e * 6 + 2] = b;
          arr[e * 6 + 3] = r; arr[e * 6 + 4] = gg; arr[e * 6 + 5] = b;
        }
        colorAttr.needsUpdate = true;
      }
    }

    // Spawn pulses (denser ambient firing, more during speech)
    if (t > nextSpawn.current && pulses.length < MAX_PULSES) {
      const newPulses: Pulse[] = [];
      const spawnCount = 2 + Math.floor(Math.random() * 4) + Math.floor(audio * 5);
      for (let k = 0; k < spawnCount; k++) {
        const edgeIdx = Math.floor(Math.random() * edges.length);
        const [ei, ej] = edges[edgeIdx];
        newPulses.push({
          id: pulseId++,
          edgeIdx,
          progress: 0,
          speed: 0.012 + Math.random() * 0.02 + audio * 0.02,
          toNode: Math.random() < 0.5 ? ei : ej,
          generation: 0,
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
          const edgeIdx = adj[k];
          const [ei, ej] = edges[edgeIdx];
          burst.push({
            id: pulseId++,
            edgeIdx,
            progress: 0,
            speed: 0.025 + Math.random() * 0.02,
            toNode: ei === nearestIdx ? ej : ei,
            generation: 0,
          });
        }
        setPulses((prev) => [...prev, ...burst]);
        lastBurst.current = t;
      }
    }

    setPulses((prev) => {
      const survivors: Pulse[] = [];
      const children: Pulse[] = [];
      const MAX_GENERATION = 4;
      for (const p of prev) {
        if (!edges[p.edgeIdx] || !nodes[p.toNode]) continue;
        const next = p.progress + p.speed;
        if (p.edgeIdx < edgeGlow.length) {
          edgeGlow[p.edgeIdx] = Math.min(1, edgeGlow[p.edgeIdx] + 0.55);
        }
        if (next <= 1) {
          survivors.push({ ...p, progress: next });
        } else if (
          p.generation < MAX_GENERATION &&
          survivors.length + children.length < MAX_PULSES &&
          Math.random() < 0.65
        ) {
          // Chain: spawn 1-2 child pulses on edges connected to the destination node
          const adj = edgesByNode[p.toNode];
          if (!adj) continue;
          // Avoid going back along the same edge
          const candidates = adj.filter((e) => e !== p.edgeIdx);
          if (candidates.length > 0) {
            const childCount = 1 + (Math.random() < 0.4 ? 1 : 0);
            for (let k = 0; k < childCount && k < candidates.length; k++) {
              const pick = candidates[Math.floor(Math.random() * candidates.length)];
              if (!edges[pick]) continue;
              const [ei, ej] = edges[pick];
              children.push({
                id: pulseId++,
                edgeIdx: pick,
                progress: 0,
                speed: p.speed * (0.85 + Math.random() * 0.3),
                toNode: ei === p.toNode ? ej : ei,
                generation: p.generation + 1,
              });
            }
          }
        }
      }
      return [...survivors, ...children];
    });
  });

  return (
    <group ref={groupRef}>

      <lineSegments>
        <bufferGeometry ref={lineGeomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={edgePositions.length / 3}
            array={edgePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={edgePositions.length / 3}
            array={edgeColors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      <instancedMesh
        ref={nodeMeshRef}
        args={[undefined, undefined, NODE_COUNT]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {pulses.filter(p => edges[p.edgeIdx] && nodes[p.toNode]).map((p) => {
        const [i, j] = edges[p.edgeIdx];
        const fromIdx = p.toNode === j ? i : j;
        const a = nodes[fromIdx];
        const b = nodes[p.toNode];
        if (!a || !b) return null;
        const x = a.x + (b.x - a.x) * p.progress;
        const y = a.y + (b.y - a.y) * p.progress;
        const z = a.z + (b.z - a.z) * p.progress;
        const intensity = Math.sin(p.progress * Math.PI);
        return (
          <mesh key={p.id} position={[x, y, z]}>
            <sphereGeometry args={[0.022, 8, 8]} />
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

// ── Background Stars (deep-space drift + constellations + warp streaks) ──
function BackgroundStars() {
  const COUNT = 300;
  const BOUNDS = { x: 8, y: 6, z: 5 }; // half-extents; total 16x12x10

  const groupRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const streaksRef = useRef<THREE.Group>(null);

  // Build star positions, per-star velocity, and depth/layer factor
  const { positions, velocities, depths, linePositions, linePairs } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const depths = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * BOUNDS.x * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;

      // 3 layers: far(0.3), mid(0.65), near(1.0)
      const r = Math.random();
      const depth = r < 0.5 ? 0.3 : r < 0.85 ? 0.65 : 1.0;
      depths[i] = depth;

      // base drift direction (random, gentle)
      velocities[i * 3] = (Math.random() - 0.5) * 0.04;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.04;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }

    // Build constellation pairs: for each star, connect to 1 nearest neighbor within threshold
    const THRESH = 1.6;
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < COUNT; i++) {
      let bestJ = -1;
      let bestD = THRESH * THRESH;
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
      for (let j = i + 1; j < Math.min(i + 25, COUNT); j++) {
        const dx = positions[j * 3] - ax;
        const dy = positions[j * 3 + 1] - ay;
        const dz = positions[j * 3 + 2] - az;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD) {
          bestD = d2;
          bestJ = j;
        }
      }
      if (bestJ !== -1) pairs.push([i, bestJ]);
    }

    const linePositions = new Float32Array(pairs.length * 6);
    for (let k = 0; k < pairs.length; k++) {
      const [a, b] = pairs[k];
      linePositions[k * 6] = positions[a * 3];
      linePositions[k * 6 + 1] = positions[a * 3 + 1];
      linePositions[k * 6 + 2] = positions[a * 3 + 2];
      linePositions[k * 6 + 3] = positions[b * 3];
      linePositions[k * 6 + 4] = positions[b * 3 + 1];
      linePositions[k * 6 + 5] = positions[b * 3 + 2];
    }

    return { positions, velocities, depths, linePositions, linePairs: pairs };
  }, []);

  // Geometries (created once, mutated per frame)
  const starGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    return g;
  }, [linePositions]);

  // Warp streaks pool
  type Streak = {
    line: THREE.Line;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    head: THREE.Vector3;
  };
  const streaksPool = useRef<Streak[]>([]);
  const nextSpawnRef = useRef<number>(1.5);
  const elapsedRef = useRef<number>(0);

  const spawnStreak = useCallback(() => {
    if (!streaksRef.current) return;
    if (streaksPool.current.length >= 4) return;

    // spawn at a random offscreen edge
    const edge = Math.floor(Math.random() * 4);
    const head = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const speed = 6 + Math.random() * 6; // fast

    if (edge === 0) {
      head.set(-BOUNDS.x - 1, (Math.random() - 0.5) * BOUNDS.y * 1.5, (Math.random() - 0.5) * BOUNDS.z);
      dir.set(1, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
    } else if (edge === 1) {
      head.set(BOUNDS.x + 1, (Math.random() - 0.5) * BOUNDS.y * 1.5, (Math.random() - 0.5) * BOUNDS.z);
      dir.set(-1, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
    } else if (edge === 2) {
      head.set((Math.random() - 0.5) * BOUNDS.x * 1.5, BOUNDS.y + 1, (Math.random() - 0.5) * BOUNDS.z);
      dir.set((Math.random() - 0.5) * 0.2, -1, (Math.random() - 0.5) * 0.2);
    } else {
      head.set((Math.random() - 0.5) * BOUNDS.x * 1.5, -BOUNDS.y - 1, (Math.random() - 0.5) * BOUNDS.z);
      dir.set((Math.random() - 0.5) * 0.2, 1, (Math.random() - 0.5) * 0.2);
    }
    dir.normalize().multiplyScalar(speed);

    // streak length proportional to speed
    const tailLen = 0.25 + speed * 0.04;
    const tail = head.clone().sub(dir.clone().normalize().multiplyScalar(tailLen));

    const geom = new THREE.BufferGeometry().setFromPoints([head.clone(), tail]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geom, mat);
    streaksRef.current.add(line);

    streaksPool.current.push({
      line,
      velocity: dir,
      life: 0,
      maxLife: 2.5,
      head,
    });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;

    // 1) Drift stars with parallax depth + wrap
    const posAttr = starGeom.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const d = depths[i];
      arr[i * 3] += velocities[i * 3] * d * dt * 60;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * d * dt * 60;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * d * dt * 60;

      // wrap around bounding box
      if (arr[i * 3] > BOUNDS.x) arr[i * 3] = -BOUNDS.x;
      else if (arr[i * 3] < -BOUNDS.x) arr[i * 3] = BOUNDS.x;
      if (arr[i * 3 + 1] > BOUNDS.y) arr[i * 3 + 1] = -BOUNDS.y;
      else if (arr[i * 3 + 1] < -BOUNDS.y) arr[i * 3 + 1] = BOUNDS.y;
      if (arr[i * 3 + 2] > BOUNDS.z) arr[i * 3 + 2] = -BOUNDS.z;
      else if (arr[i * 3 + 2] < -BOUNDS.z) arr[i * 3 + 2] = BOUNDS.z;
    }
    posAttr.needsUpdate = true;

    // 2) Refresh constellation line endpoints (skip pairs that wrapped — distance check)
    const lineAttr = lineGeom.getAttribute("position") as THREE.BufferAttribute;
    const lineArr = lineAttr.array as Float32Array;
    const MAX_LINE_DIST_SQ = 4 * 4; // hide if endpoints wrapped far apart
    for (let k = 0; k < linePairs.length; k++) {
      const [a, b] = linePairs[k];
      const ax = arr[a * 3], ay = arr[a * 3 + 1], az = arr[a * 3 + 2];
      const bx = arr[b * 3], by = arr[b * 3 + 1], bz = arr[b * 3 + 2];
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      if (dx * dx + dy * dy + dz * dz > MAX_LINE_DIST_SQ) {
        // collapse line so it's invisible
        lineArr[k * 6] = ax; lineArr[k * 6 + 1] = ay; lineArr[k * 6 + 2] = az;
        lineArr[k * 6 + 3] = ax; lineArr[k * 6 + 4] = ay; lineArr[k * 6 + 5] = az;
      } else {
        lineArr[k * 6] = ax; lineArr[k * 6 + 1] = ay; lineArr[k * 6 + 2] = az;
        lineArr[k * 6 + 3] = bx; lineArr[k * 6 + 4] = by; lineArr[k * 6 + 5] = bz;
      }
    }
    lineAttr.needsUpdate = true;

    // 3) Warp streaks: spawn + update + despawn
    if (elapsedRef.current >= nextSpawnRef.current) {
      spawnStreak();
      nextSpawnRef.current = elapsedRef.current + 2 + Math.random() * 3;
    }

    const survivors: Streak[] = [];
    for (const s of streaksPool.current) {
      s.life += dt;
      s.head.addScaledVector(s.velocity, dt);
      const dirN = s.velocity.clone().normalize();
      const tailLen = 0.25 + s.velocity.length() * 0.04;
      const tail = s.head.clone().sub(dirN.multiplyScalar(tailLen));
      const g = s.line.geometry as THREE.BufferGeometry;
      const pa = g.getAttribute("position") as THREE.BufferAttribute;
      const pArr = pa.array as Float32Array;
      pArr[0] = s.head.x; pArr[1] = s.head.y; pArr[2] = s.head.z;
      pArr[3] = tail.x; pArr[4] = tail.y; pArr[5] = tail.z;
      pa.needsUpdate = true;

      const outOfBounds =
        Math.abs(s.head.x) > BOUNDS.x + 2 ||
        Math.abs(s.head.y) > BOUNDS.y + 2 ||
        Math.abs(s.head.z) > BOUNDS.z + 2;

      if (s.life > s.maxLife || outOfBounds) {
        streaksRef.current?.remove(s.line);
        s.line.geometry.dispose();
        (s.line.material as THREE.Material).dispose();
      } else {
        survivors.push(s);
      }
    }
    streaksPool.current = survivors;

    if (groupRef.current) groupRef.current.rotation.y += dt * 0.01;
  });

  // cleanup on unmount
  useEffect(() => {
    return () => {
      for (const s of streaksPool.current) {
        s.line.geometry.dispose();
        (s.line.material as THREE.Material).dispose();
      }
      streaksPool.current = [];
    };
  }, []);

  return (
    <group ref={groupRef}>
      <points ref={starsRef} geometry={starGeom}>
        <pointsMaterial
          transparent
          color="#ffffff"
          size={0.008}
          sizeAttenuation
          depthWrite={false}
          opacity={0.55}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef} geometry={lineGeom}>
        <lineBasicMaterial
          transparent
          color="#ffffff"
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <group ref={streaksRef} />
    </group>
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
