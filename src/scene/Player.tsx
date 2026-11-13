import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { LANE_X, PLAYER_RUN_HEIGHT, PLAYER_SLIDE_HEIGHT, START_SPEED } from "../game/constants";
import { getWorld } from "../store";

/**
 * The runner: a rigged character with real skeletal animation.
 *
 * Nothing here decides anything. Position, posture and pace come from the
 * simulation; this reads them and picks a clip.
 *
 * The model is Kenney's "Animated Characters Protagonists" (CC0), converted
 * from the pack's four FBX files into one GLB by `convert.html` at the repo
 * root - see that file for what the conversion does, and for why the clips
 * had to be picked by length rather than by index.
 *
 * The pack ships idle, run and jump. There is no slide clip, so the slide is
 * still done by squashing and pitching the whole figure, and the rule that
 * used to be written here still holds: the figure is scaled so its drawn
 * height *is* the collision height, rather than a second number that can
 * drift away from it.
 */

const MODEL = "/runner.glb";

/**
 * The speed the run clip looks right at.
 *
 * The game starts at START_SPEED and climbs to nearly three times it, so the
 * clip's playback rate follows the world's speed. Left alone, a runner at
 * full pelt looks like they are being towed.
 */
const CLIP_SPEED = START_SPEED;
const MIN_RATE = 0.75;
const MAX_RATE = 2.1;

/** How long a change of clip takes to blend. Short: this is a fast game. */
const FADE = 0.18;

export function Player() {
  const root = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const shield = useRef<THREE.Mesh>(null);

  const { scene, animations } = useGLTF(MODEL);
  const { actions } = useAnimations(animations, rig);

  // One instance, so the loaded scene is used directly rather than cloned.
  // `useGLTF` caches by URL and this is the only component that asks for it.
  const model = useMemo(() => scene, [scene]);

  useLayoutEffect(() => {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
  }, [model]);

  /**
   * Fit the model to the collision box instead of hard-coding a scale.
   *
   * The character arrives at whatever size it was exported at. Measuring it
   * and scaling so the drawn height equals PLAYER_RUN_HEIGHT keeps the
   * silhouette and the box that kills you the same thing by construction,
   * and swapping the model for another one needs no new number.
   */
  useLayoutEffect(() => {
    if (!rig.current) return;
    rig.current.scale.setScalar(1);
    rig.current.position.y = 0;
    rig.current.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;
    if (height > 0) {
      const scale = PLAYER_RUN_HEIGHT / height;
      rig.current.scale.setScalar(scale);
      // Feet on the floor: an export's origin is not necessarily the sole.
      rig.current.position.y = -box.min.y * scale;
    }
  }, [model]);

  useEffect(() => {
    const run = actions.run;
    if (run) {
      run.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    const snapshot = Object.values(actions);
    return () => {
      for (const action of snapshot) action?.stop();
    };
  }, [actions]);

  /** Which clip is on screen, so a change is a cross-fade and not a cut. */
  const current = useRef<string>("run");

  useFrame((_, delta) => {
    const world = getWorld();
    const player = world.player;
    if (!root.current) return;

    root.current.position.x = player.x;
    root.current.position.y = player.y;

    const sliding = player.posture === "slide";
    const height = sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_RUN_HEIGHT;
    const squash = height / PLAYER_RUN_HEIGHT;
    root.current.scale.y += (squash - root.current.scale.y) * Math.min(1, delta * 18);

    // Leaning into a lane change, tipping forward in the air, diving on a
    // slide. `lean` is how far the eased x still is from the target lane.
    const targetX = LANE_X[player.lane] ?? 0;
    const lean = THREE.MathUtils.clamp((player.x - targetX) * -0.4, -0.45, 0.45);
    root.current.rotation.z = lean;
    const pitch = sliding ? -0.55 : player.posture === "jump" ? -0.15 : 0;
    root.current.rotation.x += (pitch - root.current.rotation.x) * Math.min(1, delta * 14);

    // At the end of a run the figure turns to face the camera. The rest of
    // the time you are looking at the back of their head, as you would be.
    const facing = world.status === "over" ? 0 : Math.PI;
    root.current.rotation.y += (facing - root.current.rotation.y) * Math.min(1, delta * 3.5);

    // Which clip. Sliding has none, so the run keeps going while the figure
    // is squashed - which, pitched forward at ankle height, reads as a dive.
    const wanted =
      world.status !== "running" ? "idle" : player.posture === "jump" ? "jump" : "run";

    if (wanted !== current.current) {
      const from = actions[current.current];
      const to = actions[wanted];
      if (to) {
        to.reset().setEffectiveWeight(1).fadeIn(FADE).play();
        // The jump clip plays once and holds, rather than looping a takeoff
        // for as long as the arc lasts.
        if (wanted === "jump") {
          to.setLoop(THREE.LoopOnce, 1);
          to.clampWhenFinished = true;
        } else {
          to.setLoop(THREE.LoopRepeat, Infinity);
        }
        from?.fadeOut(FADE);
        current.current = wanted;
      }
    }

    // The legs keep up with the world rather than with the clip's own tempo.
    const run = actions.run;
    if (run) {
      const rate = THREE.MathUtils.clamp(world.speed / CLIP_SPEED, MIN_RATE, MAX_RATE);
      run.setEffectiveTimeScale(sliding ? rate * 0.35 : rate);
    }

    if (shield.current) {
      shield.current.visible = world.shieldRemaining > 0;
      if (shield.current.visible) {
        shield.current.scale.setScalar(1 + Math.sin(world.time * 9) * 0.05);
      }
    }
  });

  return (
    <group ref={root}>
      <group ref={rig}>
        <primitive object={model} />
      </group>

      {/* The shield, drawn around the figure rather than on it. */}
      <mesh ref={shield} position={[0, PLAYER_RUN_HEIGHT * 0.52, 0]} visible={false}>
        <sphereGeometry args={[PLAYER_RUN_HEIGHT * 0.72, 20, 16]} />
        <meshBasicMaterial
          color="#19e6ff"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL);
