// Living Executive Boardroom — billboarded portrait avatars in R3F.
// Each executive is a plane textured with their MASOPS portrait, facing
// the camera at all times. Presence state drives sway/glow; the voice-bus
// drives a mouth overlay so mouths animate ONLY while their exec speaks.

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Billboard, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EXECUTIVE_LIST, type ExecutiveId } from "@/lib/executives";
import type { PresenceState } from "@/components/executive-presence";
import { useExecPresence } from "@/lib/presence-bus";
import { useMouthAmp } from "@/lib/voice-bus";
import { useExecMessage } from "@/lib/message-bus";
import irisAsset from "@/assets/exec-iris-portrait.jpg.asset.json";
import apexAsset from "@/assets/exec-apex-portrait.jpg.asset.json";
import katanaAsset from "@/assets/exec-katana-portrait.jpg.asset.json";
import sentinelAsset from "@/assets/exec-sentinel-portrait.jpg.asset.json";

const EXEC_COLORS: Record<ExecutiveId, string> = {
  iris: "#8b5cf6",
  apex: "#22d3ee",
  katana: "#ef4444",
  sentinel: "#10b981",
};

const EXEC_PORTRAITS: Record<ExecutiveId, string> = {
  iris: irisAsset.url,
  apex: apexAsset.url,
  katana: katanaAsset.url,
  sentinel: sentinelAsset.url,
};

// Arc around the table facing the Operator seat.
const POSITIONS: Record<ExecutiveId, [number, number, number]> = {
  iris:     [-2.6, 0, -0.2],
  apex:     [-0.95, 0, -1.5],
  katana:   [ 0.95, 0, -1.5],
  sentinel: [ 2.6, 0, -0.2],
};

// Mouth Y in local avatar frame — the portraits share aspect (~0.5:1) and
// the mouth lands around 62% up the plane (plane height 2.6, centered at
// y=1.4, so mouth ≈ 1.4 + 2.6*(0.62 - 0.5) = ~1.71).
const MOUTH_Y = 1.72;
const PLANE_W = 1.35;
const PLANE_H = 2.6;

function stateMotion(state: PresenceState, t: number) {
  switch (state) {
    case "thinking":
      return { sway: Math.sin(t * 0.6) * 0.04, bob: Math.sin(t * 1.8) * 0.02, glowMul: 1.6 + Math.sin(t * 3) * 0.3 };
    case "speaking":
      return { sway: Math.sin(t * 1.4) * 0.06, bob: Math.sin(t * 6) * 0.03, glowMul: 2.2 + Math.sin(t * 12) * 0.6 };
    case "reviewing":
      return { sway: Math.sin(t * 0.4) * 0.03, bob: 0, glowMul: 1.2 };
    case "listening":
      return { sway: Math.sin(t * 0.5) * 0.03, bob: Math.sin(t * 1.2) * 0.015, glowMul: 1.1 };
    case "idle":
    default:
      return { sway: Math.sin(t * 0.3) * 0.025, bob: Math.sin(t * 1.0) * 0.01, glowMul: 0.8 };
  }
}

function ExecAvatar({ id, position }: { id: ExecutiveId; position: [number, number, number] }) {
  const state = useExecPresence(id, "listening");
  const mouthAmp = useMouthAmp(id);
  const message = useExecMessage(id);
  const [expanded, setExpanded] = useState(false);
  // Auto-collapse whenever a new message arrives so the boardroom stays tidy.
  useEffect(() => { setExpanded(false); }, [message]);
  const COLLAPSED_CHARS = 160;
  const isLong = message.length > COLLAPSED_CHARS;
  const displayed = !isLong || expanded ? message : message.slice(0, COLLAPSED_CHARS).trimEnd() + "…";
  const group = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const color = EXEC_COLORS[id];
  const exec = EXECUTIVE_LIST.find((e) => e.id === id)!;
  const texture = useTexture(EXEC_PORTRAITS[id]);
  // Portraits are sRGB — mark so R3F tone-maps them correctly.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const seed = useMemo(() => Math.random() * 10, []);
  const smoothed = useRef(0);

  useFrame((s) => {
    const t = s.clock.elapsedTime + seed;
    const m = stateMotion(state, t);
    if (group.current) {
      group.current.position.y = position[1] + m.bob;
      group.current.rotation.z = m.sway * 0.15; // subtle tilt
    }
    if (glow.current) glow.current.intensity = m.glowMul;
    smoothed.current += (mouthAmp - smoothed.current) * 0.35;
    if (mouth.current) {
      const open = 0.03 + smoothed.current * 0.18;
      mouth.current.scale.set(1, Math.max(0.2, open * 5), 1);
      const mat = mouth.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.25 + smoothed.current * 1.4;
      mat.opacity = 0.15 + smoothed.current * 0.55;
    }
  });

  return (
    <group ref={group} position={position}>
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        {/* Portrait plane */}
        <mesh position={[0, PLANE_H / 2, 0]}>
          <planeGeometry args={[PLANE_W, PLANE_H]} />
          <meshBasicMaterial map={texture} transparent={false} toneMapped={true} />
        </mesh>
        {/* Signature-color rim glow behind the portrait */}
        <mesh position={[0, PLANE_H / 2, -0.05]}>
          <planeGeometry args={[PLANE_W * 1.15, PLANE_H * 1.06]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>
        {/* Mouth overlay — glows/opens only while this exec speaks */}
        <mesh ref={mouth} position={[0, MOUTH_Y, 0.01]}>
          <planeGeometry args={[0.14, 0.02]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={color}
            emissiveIntensity={0.25}
            transparent
            opacity={0.15}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <pointLight ref={glow} position={[0, 1.9, 0.6]} color={color} intensity={1.2} distance={3.5} decay={2} />
      <Html position={[0, PLANE_H + 0.15, 0]} center distanceFactor={8} occlude={false}>
        <div className="pointer-events-none select-none text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em]" style={{ color }}>
            {exec.name}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-white/60">{state}</div>
        </div>
      </Html>
      {message && (
        <Html
          position={[0, PLANE_H + 0.75, 0]}
          center
          distanceFactor={7}
          occlude={false}
          zIndexRange={[100, 0]}
        >
          <div className="pointer-events-auto w-[260px] -translate-y-1">
            <div
              className="relative rounded-xl border bg-black/80 px-3 py-2 text-[11px] leading-relaxed text-white/90 shadow-lg backdrop-blur"
              style={{ borderColor: color, boxShadow: `0 0 18px ${color}55` }}
            >
              <div
                className="mb-0.5 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-[0.3em]"
                style={{ color }}
              >
                <span>{exec.name}</span>
                {isLong && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    className="rounded border border-white/15 px-1.5 py-0.5 text-[8px] tracking-widest text-white/70 hover:bg-white/10"
                  >
                    {expanded ? "Less" : "More"}
                  </button>
                )}
              </div>
              <div
                className={`relative whitespace-pre-wrap break-words text-[11px] ${
                  expanded ? "max-h-64 overflow-y-auto pr-1" : "max-h-[5.5rem] overflow-hidden"
                }`}
                style={{ fontSize: isLong && !expanded ? "10px" : "11px", lineHeight: "1.55" }}
              >
                {displayed}
                {!expanded && isLong && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full"
                    style={{
                      background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))",
                    }}
                  />
                )}
              </div>
              <div
                className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r bg-black/80"
                style={{ borderColor: color }}
              />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function BoardroomStage() {
  return (
    <>
      <mesh position={[0, 0.35, -0.6]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 0.08, 48]} />
        <meshStandardMaterial color="#141420" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.4, -0.6]}>
        <torusGeometry args={[1.6, 0.015, 12, 64]} />
        <meshBasicMaterial color="#c9a24a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#0a0a12" metalness={0.9} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 1.6]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent />
      </mesh>
    </>
  );
}

export default function BoardroomScene() {
  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-lg border border-border/60 bg-[#05050a]">
      <Canvas shadows="basic" camera={{ position: [0, 2.4, 5.4], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={["#05050a"]} />
        <fog attach="fog" args={["#05050a", 7, 16]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={0.6} />
        <Suspense fallback={null}>
          <BoardroomStage />
          {EXECUTIVE_LIST.map((e) => (
            <ExecAvatar key={e.id} id={e.id} position={POSITIONS[e.id]} />
          ))}
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3.5}
          maxDistance={9}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 1.4, -0.6]}
        />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/40 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-white/60 backdrop-blur">
        Boardroom · Live Presence
      </div>
    </div>
  );
}
