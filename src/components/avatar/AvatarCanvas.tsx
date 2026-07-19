// 3D avatar canvas — React Three Fiber renderer.
//
// This is the extension point where GLB/GLTF executive models will be
// dropped in. Today the framework has no models, so this canvas renders a
// simple identity-tinted primitive that responds to state (breath, tilt,
// speaking pulse) and lip-sync amplitude. When a real model is provided in
// the config, the loader path below activates automatically.
//
// The canvas is intentionally lightweight and lazy-loaded via React.lazy in
// the unified entry — the placeholder avatar path never pays for Three.
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ExecutiveAvatarConfig, AvatarPresenceInputs, CameraPreset, LightingPreset } from "@/lib/avatar/types";
import { useLipSyncAmp } from "@/lib/avatar/hooks";

interface Props {
  config: ExecutiveAvatarConfig;
  inputs: AvatarPresenceInputs;
  size: number;
  interactive?: boolean;
}

const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number]; fov: number }> = {
  portrait: { position: [0, 1.55, 1.6], fov: 22 },
  bust: { position: [0, 1.6, 1.9], fov: 28 },
  wide: { position: [0, 1.6, 3.2], fov: 35 },
  cinematic: { position: [1.4, 1.7, 2.4], fov: 32 },
};

function readColorToken(token: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw ? `hsl(${raw})` : fallback;
}

function Lights({ preset, color }: { preset: LightingPreset; color: string }) {
  // Warm/cool key + rim mix tuned per executive environment.
  const intensity = preset === "vault" ? 0.6 : preset === "warroom" ? 1.1 : 0.9;
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[2, 3, 2]} intensity={intensity} color={color} />
      <pointLight position={[-2, 1.5, 1]} intensity={0.35} color={color} />
    </>
  );
}

/** Placeholder primitive used when the config has no modelUrl. */
function PrimitiveAvatar({ inputs, color, mouthAmp }: { inputs: AvatarPresenceInputs; color: string; mouthAmp: number }) {
  const group = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (group.current) {
      const breath = Math.sin(t * 1.4) * 0.02;
      group.current.position.y = 1.5 + breath;
      group.current.rotation.y = inputs.state === "thinking" ? Math.sin(t * 0.6) * 0.12 : 0;
    }
    if (mouth.current) {
      // Scale mouth on lip-sync amplitude; falls back to speaking pulse.
      const target = inputs.state === "speaking" ? Math.max(mouthAmp, 0.15 + Math.sin(t * 12) * 0.1) : 0;
      mouth.current.scale.y = THREE.MathUtils.lerp(mouth.current.scale.y, 0.2 + target, 0.3);
    }
  });

  return (
    <group ref={group} position={[0, 1.5, 0]}>
      {/* head */}
      <mesh castShadow>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.12, 0.05, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.12, 0.05, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.4} />
      </mesh>
      {/* mouth (lip-sync driven) */}
      <mesh ref={mouth} position={[0, -0.14, 0.31]}>
        <boxGeometry args={[0.16, 0.05, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {/* shoulders / base */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.5, 24]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} opacity={0.85} transparent />
      </mesh>
    </group>
  );
}

/** Real GLB path — invoked when config.modelUrl is set. */
function GLBAvatar({ url, scale, inputs, mouthAmp }: { url: string; scale: number; inputs: AvatarPresenceInputs; mouthAmp: number }) {
  const gltf = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (group.current) {
      group.current.position.y = Math.sin(t * 1.2) * 0.01;
    }
    // Future: animation mixer transitions keyed off inputs.state,
    // morph-target updates keyed off mouthAmp. Stubbed intentionally.
    void inputs;
    void mouthAmp;
  });
  return (
    <group ref={group} scale={scale}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export default function AvatarCanvas({ config, inputs, size, interactive = false }: Props) {
  const mouthAmp = useLipSyncAmp(config.executive);
  const cam = CAMERA_PRESETS[config.camera];
  const color = useMemo(() => readColorToken(config.colorToken, "#8b5cf6"), [config.colorToken]);

  return (
    <div style={{ width: size, height: size }} className="relative">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: cam.position, fov: cam.fov }}
        gl={{ antialias: true, alpha: true }}
      >
        <Lights preset={config.lighting} color={color} />
        <Suspense fallback={null}>
          {config.modelUrl ? (
            <GLBAvatar url={config.modelUrl} scale={config.modelScale ?? 1} inputs={inputs} mouthAmp={mouthAmp} />
          ) : (
            <PrimitiveAvatar inputs={inputs} color={color} mouthAmp={mouthAmp} />
          )}
        </Suspense>
        {interactive && <OrbitControls enablePan={false} enableZoom={false} />}
      </Canvas>
    </div>
  );
}
