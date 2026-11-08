import { Suspense, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { playEvents } from "../audio";
import { MAX_SPEED, START_SPEED } from "../game/constants";
import { getWorld, useGame } from "../store";
import { Effects } from "./Effects";
import { Entities } from "./Entities";
import { Player } from "./Player";
import { Sparks } from "./Sparks";
import { Track } from "./Track";

/**
 * Drives the simulation, once per frame, before anything draws.
 *
 * The negative priority matters: every other `useFrame` in the scene reads
 * the world, so the world has to have been advanced first. Without it the
 * meshes lag the simulation by a frame, which looks like input lag and is
 * maddening to diagnose from the outside.
 */
function Simulation() {
  const tick = useGame((state) => state.tick);

  useFrame((_, delta) => {
    const events = tick(delta);
    if (events.length > 0) playEvents(events);
  }, -100);

  return null;
}

/** Follows the runner without being bolted to them. */
function CameraRig() {
  const { camera } = useThree();
  const shake = useRef(0);

  useFrame((_, delta) => {
    const world = getWorld();
    const player = world.player;
    const pace = THREE.MathUtils.clamp(
      (world.speed - START_SPEED) / (MAX_SPEED - START_SPEED),
      0,
      1,
    );

    // Trailing the lane change rather than matching it, so the track appears
    // to swing under the runner.
    const targetX = player.x * 0.42;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, delta * 6);

    const targetZ = 9.8 + pace * 2.4;
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, delta * 2);
    camera.position.y = 4.7 + player.y * 0.3;

    // Widening the lens as the run speeds up stretches the edges of the frame
    // and reads as acceleration. It is most of what motion blur would buy,
    // for none of the cost.
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = 60 + pace * 13;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov += (fov - camera.fov) * Math.min(1, delta * 1.6);
        camera.updateProjectionMatrix();
      }
    }

    if (world.status === "over") shake.current = Math.min(1, shake.current + delta * 5);
    else shake.current = Math.max(0, shake.current - delta * 2.2);

    const jolt = shake.current * 0.11;
    camera.position.x += (Math.random() - 0.5) * jolt;
    camera.position.y += (Math.random() - 0.5) * jolt;

    camera.lookAt(player.x * 0.5, 1.0 + player.y * 0.35, -24);
  });

  return null;
}

export function GameScene() {
  return (
    <>
      <Simulation />
      <CameraRig />

      <color attach="background" args={["#03040a"]} />
      {/* Tight, so obstacles resolve out of the dark rather than popping in,
          and the far city stays a silhouette. */}
      <fog attach="fog" args={["#03040a", 30, 120]} />

      {/* Almost no ambient: the look depends on most surfaces being nearly
          black so the emissive ones can carry the frame. */}
      <hemisphereLight args={["#16224a", "#02030a", 0.35]} />
      <directionalLight
        position={[6, 18, 6]}
        intensity={0.55}
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      {/* Two rim lights, cyan from the left and magenta from the right. A
          single white key light is what made the first version look like
          plastic toys. */}
      <pointLight position={[-5, 3.2, 2]} intensity={26} distance={20} color="#19e6ff" />
      <pointLight position={[5, 3.2, -4]} intensity={22} distance={22} color="#ff2d9c" />

      <Track />
      <Entities />
      <Sparks />
      {/* The runner's face is a texture and `useTexture` suspends while it
          loads. Without a boundary that suspension unmounts the whole scene
          for a frame; with one, the track is already there. */}
      <Suspense fallback={null}>
        <Player />
      </Suspense>

      <Effects />
    </>
  );
}
