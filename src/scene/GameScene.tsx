import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { playEvents } from "../audio";
import { MAX_SPEED, START_SPEED } from "../game/constants";
import { getWorld, useGame } from "../store";
import { Entities } from "./Entities";
import { Player } from "./Player";
import { Track } from "./Track";

/**
 * Drives the simulation, once per frame, before anything draws.
 *
 * The negative priority matters: every other `useFrame` in the scene reads
 * the world, so the world has to have been advanced first. Without it the
 * meshes lag the simulation by a frame, which looks like input delay and is
 * maddening to debug from the outside.
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

    // Trailing the lane change rather than matching it: the track appears to
    // swing, which reads as speed.
    const targetX = player.x * 0.42;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, delta * 6);

    // Pulling back as the run gets faster widens the view just when there is
    // more to react to.
    const pace = (world.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
    const targetZ = 9.8 + pace * 2.4;
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, delta * 2);
    camera.position.y = 4.7 + player.y * 0.3;

    if (world.status === "over") shake.current = Math.min(1, shake.current + delta * 4);
    else shake.current = Math.max(0, shake.current - delta * 2);

    const jolt = shake.current * 0.09;
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

      <color attach="background" args={["#05060d"]} />
      {/* Far enough that obstacles fade in rather than popping. */}
      <fog attach="fog" args={["#05060d", 38, 135]} />

      <hemisphereLight args={["#2a3b6b", "#05060d", 0.75]} />
      <directionalLight
        position={[6, 18, 6]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[0, 4, 3]} intensity={18} distance={22} color="#22d3ee" />

      <Track />
      <Entities />
      <Player />
    </>
  );
}
