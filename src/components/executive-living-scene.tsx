// ExecutiveLivingScene — a single-executive R3F living portrait.
// The executive stands inside their own headquarters: signature-color
// ambient panels, holographic particles, and depth. The portrait breathes,
// blinks, glances toward the pointer, and reacts to presence + voice state.
// This is the "living executive" surface used on the /office/:exec pages.
//
// Design notes
// - Reuses the existing MASOPS portrait assets so identity stays canonical.
// - Voice + presence buses drive motion so voice can layer in later without
//   redesigning the scene contract.
// - No orbit controls: the camera stays fixed for a stable "the executive is
//   in the room with you" feel. Interaction is pointer-driven only.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { useExecPresence } from "@/lib/presence-bus";
import { useMouthAmp } from "@/lib/voice-bus";
import type { PresenceState } from "@/components/executive-presence";
import irisAsset from "@/assets/exec-iris-portrait.jpg.asset.json";
import apexAsset from "@/assets/exec-apex-portrait.jpg.asset.json";
import katanaAsset from "@/assets/exec-katana-portrait.jpg.asset.json";
import sentinelAsset from "@/assets/exec-sentinel-portrait.jpg.asset.json";
import hqIris from "@/assets/hq-iris.jpg.asset.json";
import hqApex from "@/assets/hq-apex.jpg.asset.json";
import hqKatana from "@/assets/hq-katana.jpg.asset.json";
import hqSentinel from "@/assets/hq-sentinel.jpg.asset.json";

const EXEC_COLORS: Record<ExecutiveId, string> = {
  iris: "#8b5cf6",
  apex: "#22d3ee",
  katana: "#ef4444",
  sentinel: "#10b981",
};

const EXEC_ACCENT2: Record<ExecutiveId, string> = {
  iris: "#f5d67a",
  apex: "#3b82f6",
  katana: "#f97316",
  sentinel: "#0ea5e9",
};

const EXEC_PORTRAITS: Record<ExecutiveId, string> = {
  iris: irisAsset.url,
  apex: apexAsset.url,
  katana: katanaAsset.url,
  sentinel: sentinelAsset.url,
};

const EXEC_HQ: Record<ExecutiveId, string> = {
  iris: hqIris.url,
  apex: hqApex.url,
  katana: hqKatana.url,
  sentinel: hqSentinel.url,
};

const PLANE_W = 2.1;
const PLANE_H = 3.2;
// Vertical offset — shifts the character down inside the frame so the head
// clears the top edge and the whole figure (head-to-shoulders) is visible.
const PLANE_Y = -0.35;
const MOUTH_Y = PLANE_Y + PLANE_H * 0.62; // ~ mouth line on the portrait

function stateMotion(state: PresenceState, t: number) {
  switch (state) {
    case "thinking":
      return { bob: Math.sin(t * 1.7) * 0.03, sway: Math.sin(t * 0.6) * 0.04, glow: 1.6 };
    case "speaking":
      return { bob: Math.sin(t * 5.5) * 0.04, sway: Math.sin(t * 1.4) * 0.05, glow: 2.2 };
    case "reviewing":
      return { bob: Math.sin(t * 0.9) * 0.015, sway: Math.sin(t * 0.4) * 0.025, glow: 1.2 };
    case "listening":
      return { bob: Math.sin(t * 1.1) * 0.02, sway: Math.sin(t * 0.5) * 0.03, glow: 1.1 };
    case "idle":
    default:
      return { bob: Math.sin(t * 0.9) * 0.012, sway: Math.sin(t * 0.3) * 0.02, glow: 0.85 };
  }
}

/** Blink cadence — closes for ~120ms every 3.5–7s. */
function useBlink() {
  const nextBlink = useRef<number>(Math.random() * 3 + 2);
  const blinkUntil = useRef<number>(0);
  return (t: number) => {
    if (t > nextBlink.current && t > blinkUntil.current) {
      blinkUntil.current = t + 0.12;
      nextBlink.current = t + 3.5 + Math.random() * 3.5;
    }
    return t < blinkUntil.current;
  };
}

function ExecutivePortrait({ id }: { id: ExecutiveId }) {
  const state = useExecPresence(id, "listening");
  const mouthAmp = useMouthAmp(id);
  const color = EXEC_COLORS[id];
  const texture = useTexture(EXEC_PORTRAITS[id]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const group = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const blinkVeil = useRef<THREE.Mesh>(null);
  const rim = useRef<THREE.PointLight>(null);
  const smoothed = useRef(0);
  const glance = useRef(new THREE.Vector2());
  const glanceTarget = useRef(new THREE.Vector2());
  const seed = useMemo(() => Math.random() * 10, []);
  const shouldBlink = useBlink();

  const { pointer } = useThree();

  useFrame((s) => {
    const t = s.clock.elapsedTime + seed;
    const m = stateMotion(state, t);

    // Glance toward pointer, softly.
    glanceTarget.current.set(pointer.x * 0.18, pointer.y * 0.1);
    glance.current.lerp(glanceTarget.current, 0.06);

    if (group.current) {
      group.current.position.y = m.bob;
      group.current.rotation.y = glance.current.x + m.sway * 0.05;
      group.current.rotation.x = -glance.current.y * 0.35;
      group.current.rotation.z = m.sway * 0.05;
    }
    if (rim.current) rim.current.intensity = m.glow;

    // Mouth glow while speaking (voice bus)
    smoothed.current += (mouthAmp - smoothed.current) * 0.3;
    if (mouth.current) {
      const open = 0.02 + smoothed.current * 0.2;
      mouth.current.scale.set(1, Math.max(0.25, open * 5), 1);
      const mat = mouth.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.2 + smoothed.current * 1.4;
      mat.opacity = 0.12 + smoothed.current * 0.55;
    }

    // Blink veil visibility
    if (blinkVeil.current) {
      const mat = blinkVeil.current.material as THREE.MeshBasicMaterial;
      mat.opacity = shouldBlink(t) ? 0.85 : 0;
    }
  });

  return (
    <group ref={group}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, PLANE_Y + PLANE_H / 2, 0]}>
          <planeGeometry args={[PLANE_W, PLANE_H]} />
          <meshBasicMaterial map={texture} toneMapped />
        </mesh>
        {/* Signature-color rim glow */}
        <mesh position={[0, PLANE_Y + PLANE_H / 2, -0.05]}>
          <planeGeometry args={[PLANE_W * 1.18, PLANE_H * 1.06]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} />
        </mesh>
        {/* Blink veil across eye line (28% down from top → y ≈ H*0.72) */}
        <mesh ref={blinkVeil} position={[0, PLANE_Y + PLANE_H * 0.72, 0.02]}>
          <planeGeometry args={[PLANE_W * 0.75, PLANE_H * 0.05]} />
          <meshBasicMaterial color="#050508" transparent opacity={0} toneMapped={false} />
        </mesh>
        {/* Mouth overlay — glows only while speaking */}
        <mesh ref={mouth} position={[0, MOUTH_Y, 0.02]}>
          <planeGeometry args={[0.18, 0.025]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={color}
            emissiveIntensity={0.2}
            transparent
            opacity={0.12}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <pointLight ref={rim} position={[0, 2.2, 0.9]} color={color} intensity={1.1} distance={5} decay={2} />
    </group>
  );
}

/** Headquarters backdrop — a real photographic HQ scene behind the executive
 *  with subtle parallax, animated depth, dust motes, and volumetric key/rim
 *  lighting in the executive's signature color. */
function Headquarters({ id }: { id: ExecutiveId }) {
  const primary = EXEC_COLORS[id];
  const accent = EXEC_ACCENT2[id];
  const backdropTex = useTexture(EXEC_HQ[id]);
  backdropTex.colorSpace = THREE.SRGBColorSpace;
  backdropTex.anisotropy = 8;

  const backdrop = useRef<THREE.Mesh>(null);
  const wash = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const { pointer } = useThree();

  // Floating dust motes / light particles in the exec accent color.
  const particleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = 70;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 7;
      positions[i * 3 + 1] = Math.random() * 3.5 + 0.3;
      positions[i * 3 + 2] = -Math.random() * 2.2 - 0.4;
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    // Subtle parallax on the backdrop as the pointer moves — sells depth.
    if (backdrop.current) {
      backdrop.current.position.x = -pointer.x * 0.12;
      backdrop.current.position.y = 2 - pointer.y * 0.06;
    }
    if (wash.current) {
      const mat = wash.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(t * 0.5) * 0.04;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.015;
      const mat = particlesRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.28 + Math.sin(t * 0.8) * 0.08;
    }
  });

  return (
    <>
      {/* Photographic HQ backdrop */}
      <mesh ref={backdrop} position={[0, 2, -3.2]}>
        <planeGeometry args={[9.6, 6.4]} />
        <meshBasicMaterial map={backdropTex} toneMapped />
      </mesh>
      {/* Signature-color atmospheric wash over the backdrop (mood) */}
      <mesh ref={wash} position={[0, 2, -3.1]}>
        <planeGeometry args={[9.6, 6.4]} />
        <meshBasicMaterial color={primary} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {/* Vignette darkening around the edges to focus attention on the executive */}
      <mesh position={[0, 2, -3.05]}>
        <planeGeometry args={[9.6, 6.4]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Reflective floor catching the exec's rim light */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.5]}>
        <circleGeometry args={[5, 48]} />
        <meshStandardMaterial color="#050510" metalness={0.9} roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.5]}>
        <ringGeometry args={[1.15, 1.25, 64]} />
        <meshBasicMaterial color={primary} transparent opacity={0.45} />
      </mesh>
      {/* Floating dust / light motes */}
      <points ref={particlesRef} geometry={particleGeom}>
        <pointsMaterial
          color={accent}
          size={0.04}
          transparent
          opacity={0.3}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      {/* Three-point-style volumetric lighting in the exec color */}
      <pointLight position={[-2.5, 3, 1.5]} color={primary} intensity={0.9} distance={7} decay={2} />
      <pointLight position={[3, 2.5, 1.5]} color={accent} intensity={0.7} distance={7} decay={2} />
      <pointLight position={[0, 1.4, -2]} color={primary} intensity={0.5} distance={6} decay={2} />
    </>
  );
}

interface Props {
  executive: ExecutiveId;
  className?: string;
}

export default function ExecutiveLivingScene({ executive, className }: Props) {
  const exec = EXECUTIVES[executive];
  const color = EXEC_COLORS[executive];

  return (
    <div
      className={`relative mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border/50 bg-[#04040a] sm:aspect-[7/9] sm:max-w-[380px] ${className ?? ""}`}
      aria-label={`${exec.name} — ${exec.environment}`}
    >
      <Canvas camera={{ position: [0, 1.4, 6.4], fov: 42 }} dpr={[1, 2]} shadows={false}>
        <color attach="background" args={["#04040a"]} />
        <fog attach="fog" args={["#04040a", 5, 12]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 5, 3]} intensity={0.55} />
        <Suspense fallback={null}>
          <Headquarters id={executive} />
          <ExecutivePortrait id={executive} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/40 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.3em] backdrop-blur">
        <span style={{ color }}>{exec.name}</span>
        <span className="mx-1.5 text-white/30">·</span>
        <span className="text-white/70">{exec.environment}</span>
      </div>
    </div>
  );
}
