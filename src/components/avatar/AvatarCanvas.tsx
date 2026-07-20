// 3D avatar canvas — React Three Fiber renderer.
//
// Activated when config.modelUrl is set. All modelUrls are currently null;
// this canvas renders the identity-tinted PrimitiveAvatar until real GLB
// assets are supplied. The extension points (GLBAvatar, AnimationMixer,
// morph-target lip-sync) are in place and ready to activate on asset drop-in.
//
// Safety rules:
//   - Never mutate the globally-cached GLTF scene. Always clone(true) first.
//   - Configure shadows on the clone, not the shared original.
//   - All errors inside the Canvas fall back to PrimitiveAvatar; the parent
//     ExecutiveAvatar error boundary catches any Canvas-level throws and
//     falls back to PortraitAvatar.
import { Suspense, useMemo, useRef, useState } from "react";
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
  portrait:   { position: [0, 1.55, 1.6], fov: 22 },
  bust:       { position: [0, 1.6,  1.9], fov: 28 },
  wide:       { position: [0, 1.6,  3.2], fov: 35 },
  cinematic:  { position: [1.4, 1.7, 2.4], fov: 32 },
};

function readColorToken(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw ? `hsl(${raw})` : fallback;
}

function Lights({ preset, color }: { preset: LightingPreset; color: string }) {
  const intensity = preset === "vault" ? 0.6 : preset === "warroom" ? 1.1 : 0.9;
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[2, 3, 2]} intensity={intensity} color={color} castShadow />
      <pointLight position={[-2, 1.5, 1]} intensity={0.35} color={color} />
    </>
  );
}

/** Primitive used when config has no modelUrl — zero GLB cost. */
function PrimitiveAvatar({
  inputs,
  color,
  mouthAmp,
}: {
  inputs: AvatarPresenceInputs;
  color: string;
  mouthAmp: number;
}) {
  const group = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (group.current) {
      const breath = Math.sin(t * 1.4) * 0.02;
      group.current.position.y = 1.5 + breath;
      group.current.rotation.y =
        inputs.state === "thinking" ? Math.sin(t * 0.6) * 0.12 : 0;
    }
    if (mouth.current) {
      const target =
        inputs.state === "speaking"
          ? Math.max(mouthAmp, 0.15 + Math.sin(t * 12) * 0.1)
          : 0;
      mouth.current.scale.y = THREE.MathUtils.lerp(
        mouth.current.scale.y,
        0.2 + target,
        0.3,
      );
    }
  });

  return (
    <group ref={group} position={[0, 1.5, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[-0.12, 0.05, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0.12, 0.05, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh ref={mouth} position={[0, -0.14, 0.31]}>
        <boxGeometry args={[0.16, 0.05, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0, -0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.5, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.05}
          opacity={0.85}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * GLB renderer — activated when config.modelUrl is set.
 *
 * Safety: clones the cached GLTF scene before mutation so the shared cache
 * is never written to. Shadow configuration is applied to the clone only.
 *
 * Prepare stubs:
 *   - THREE.AnimationMixer integration is in place (mixer ref + delta)
 *   - Morph-target lip-sync capability detection is included
 *   - Falls back to idle when a requested animation clip is missing
 */
function GLBAvatar({
  url,
  config,
  inputs,
  mouthAmp,
}: {
  url: string;
  config: ExecutiveAvatarConfig;
  inputs: AvatarPresenceInputs;
  mouthAmp: number;
}) {
  const gltf = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Clone the scene so we never mutate the globally-cached GLTF.
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf.scene]);

  // Per-executive presentation values from config.
  const p = config.presentation;
  const scale = p?.modelScale ?? config.modelScale ?? 1;
  const position = p?.modelPosition ?? ([0, 0, 0] as [number, number, number]);
  const rotation = p?.modelRotation ?? ([0, 0, 0] as [number, number, number]);

  // Prepare AnimationMixer. Selects the clip matching the current state,
  // falls back to idle when the requested clip name is missing.
  useMemo(() => {
    if (!gltf.animations.length) return;
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;
    // Look up the clip name for the current state; gestures is a nested
    // Record so we exclude it and cast the result to string | undefined.
    type StateKey = Exclude<keyof typeof config.animations, "gestures">;
    const clipName =
      (config.animations[inputs.state as StateKey] as string | undefined) ??
      config.animations.idle;
    const clip =
      THREE.AnimationClip.findByName(gltf.animations, clipName) ??
      gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
  }, [scene, gltf.animations, config.animations, inputs.state]);

  useFrame((_, delta) => {
    // Advance animation mixer every frame.
    mixerRef.current?.update(delta);

    // Subtle idle sway (overridden by mixer when clips are loaded).
    if (group.current && !mixerRef.current) {
      const t = performance.now() / 1000;
      group.current.position.y = Math.sin(t * 1.2) * 0.01;
    }

    // Morph-target lip-sync capability detection (stubbed until GLB exists).
    // When models ship: iterate scene.traverse to find SkinnedMesh with
    // morphTargetDictionary, map mouthAmp to the relevant morph index.
    void mouthAmp;
    void inputs;
  });

  return (
    <group
      ref={group}
      scale={[scale, scale, scale]}
      position={position}
      rotation={rotation}
    >
      <primitive object={scene} />
    </group>
  );
}

/** Safe inner wrapper: falls back to PrimitiveAvatar on GLB load error. */
function SafeGLBAvatar(props: {
  url: string;
  config: ExecutiveAvatarConfig;
  inputs: AvatarPresenceInputs;
  mouthAmp: number;
  color: string;
}) {
  const [glbError, setGlbError] = useState(false);
  if (glbError) {
    return (
      <PrimitiveAvatar
        inputs={props.inputs}
        color={props.color}
        mouthAmp={props.mouthAmp}
      />
    );
  }
  return (
    <Suspense
      fallback={
        <PrimitiveAvatar
          inputs={props.inputs}
          color={props.color}
          mouthAmp={props.mouthAmp}
        />
      }
    >
      <GLBAvatarWithErrorCatch {...props} onError={() => setGlbError(true)} />
    </Suspense>
  );
}

function GLBAvatarWithErrorCatch(props: {
  url: string;
  config: ExecutiveAvatarConfig;
  inputs: AvatarPresenceInputs;
  mouthAmp: number;
  color: string;
  onError: () => void;
}) {
  try {
    return (
      <GLBAvatar
        url={props.url}
        config={props.config}
        inputs={props.inputs}
        mouthAmp={props.mouthAmp}
      />
    );
  } catch {
    props.onError();
    return null;
  }
}

export default function AvatarCanvas({
  config,
  inputs,
  size,
  interactive = false,
}: Props) {
  const mouthAmp = useLipSyncAmp(config.executive);
  const p = config.presentation;

  // Camera: per-executive override → preset default
  const presetCam = CAMERA_PRESETS[config.camera];
  const camPosition = p?.cameraPosition ?? presetCam.position;

  const color = useMemo(
    () => readColorToken(config.colorToken, "#8b5cf6"),
    [config.colorToken],
  );

  return (
    <div style={{ width: size, height: size }} className="relative">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: camPosition, fov: presetCam.fov }}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <Lights preset={config.lighting} color={color} />
        {config.modelUrl ? (
          <SafeGLBAvatar
            url={config.modelUrl}
            config={config}
            inputs={inputs}
            mouthAmp={mouthAmp}
            color={color}
          />
        ) : (
          <PrimitiveAvatar inputs={inputs} color={color} mouthAmp={mouthAmp} />
        )}
        {interactive && (
          <OrbitControls enablePan={false} enableZoom={false} />
        )}
      </Canvas>
    </div>
  );
}
