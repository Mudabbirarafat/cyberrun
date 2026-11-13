import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { LANE_X, MAX_SPEED, PLAYER_RUN_HEIGHT, START_SPEED } from "../game/constants";
import { getWorld } from "../store";
import { buildCrouchClip, buildSlideClip, buildSprintClip } from "./clips";

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
// Deliberately below START_SPEED, so the clip is already running faster
// than it was authored at the moment the game begins. At 1x the cycle is
// 0.667s - about a stride and a half a second, which is a jog, and against
// a city going past at eleven units a second it reads as someone who does
// not much care whether they make it.
const CLIP_SPEED = 6.4;
/** 0 at START_SPEED, 1 at MAX_SPEED. How hard the sprint lean is applied. */
const paceOf = (speed: number) =>
  Math.min(1, Math.max(0, (speed - START_SPEED) / (MAX_SPEED - START_SPEED)));
const MIN_RATE = 1.35;
const MAX_RATE = 2.75;

/** How long a change of clip takes to blend. Short: this is a fast game. */
const FADE = 0.18;

export function Player() {
  const root = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const shield = useRef<THREE.Mesh>(null);

  const { scene, animations } = useGLTF(MODEL);

  // One instance, so the loaded scene is used directly rather than cloned.
  // `useGLTF` caches by URL and this is the only component that asks for it.
  const model = useMemo(() => scene, [scene]);

  // The pack ships idle, run and jump. The slide is keyed onto the same rig
  // at load time rather than downloaded from somewhere else - see
  // `slideClip.ts` - so it goes through the same mixer and cross-fades like
  // any other clip.
  const clips = useMemo(
    () => [
      ...animations,
      buildSlideClip(model),
      buildSprintClip(model),
      buildCrouchClip(model),
    ],
    [animations, model],
  );

  const { actions } = useAnimations(clips, rig);

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
    actions.run?.reset().setLoop(THREE.LoopRepeat, Infinity).play();

    // The two additive layers run permanently at zero weight. Starting and
    // stopping them would mean a fade every time the pace changed or a
    // landing happened; leaving them playing makes the weight the only
    // thing that moves, which is one number per frame.
    for (const name of ["sprint", "crouch"] as const) {
      const action = actions[name];
      if (!action) continue;
      action.blendMode = THREE.AdditiveAnimationBlendMode;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveWeight(0);
      action.play();
      // Held at the end of the one-second ramp: these are poses, not
      // animations, and the weight is what animates them.
      action.time = 1;
      action.paused = true;
    }

    const snapshot = Object.values(actions);
    return () => {
      for (const action of snapshot) action?.stop();
    };
  }, [actions]);

  /** Which clip is on screen, so a change is a cross-fade and not a cut. */
  const current = useRef<string>("run");
  /** Airborne last frame, so a landing can be noticed without the sim. */
  const airborne = useRef(false);
  /** Spikes to 1 on landing and decays, driving the crouch layer. */
  const landing = useRef(0);

  useFrame((_, delta) => {
    const world = getWorld();
    const player = world.player;
    if (!root.current) return;

    root.current.position.x = player.x;
    root.current.position.y = player.y;

    const sliding = player.posture === "slide";

    // The box figure used to be squashed by the full ratio of the two
    // collision heights, which made the drawn height and the collision
    // height the same number by construction. A posed skeleton already
    // brings the body most of the way down, and squashing it by another
    // 53% on top turned the slide into a pancake. So the scale is now a
    // nudge and the pose does the work.
    //
    // What that costs: the silhouette during a slide is close to the
    // collision box rather than equal to it. The box is still the authority
    // - PLAYER_SLIDE_HEIGHT is what the overhead check uses - so this is a
    // question of how it looks, not of what you get away with.
    const squash = sliding ? 0.86 : 1;
    root.current.scale.y += (squash - root.current.scale.y) * Math.min(1, delta * 18);

    // Leaning into a lane change, tipping forward in the air, diving on a
    // slide. `lean` is how far the eased x still is from the target lane.
    const targetX = LANE_X[player.lane] ?? 0;
    const lean = THREE.MathUtils.clamp((player.x - targetX) * -0.4, -0.45, 0.45);
    root.current.rotation.z = lean;
    // Less pitch than before: the slide clip now does most of the leaning,
    // and stacking the two tipped the runner onto their back.
    const pitch = sliding ? -0.18 : player.posture === "jump" ? -0.15 : 0;
    root.current.rotation.x += (pitch - root.current.rotation.x) * Math.min(1, delta * 14);

    // At the end of a run the figure turns to face the camera. The rest of
    // the time you are looking at the back of their head, as you would be.
    const facing = world.status === "over" ? 0 : Math.PI;
    root.current.rotation.y += (facing - root.current.rotation.y) * Math.min(1, delta * 3.5);

    const wanted =
      world.status !== "running"
        ? "idle"
        : sliding
          ? "slide"
          : player.posture === "jump"
            ? "jump"
            : "run";

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
      run.setEffectiveTimeScale(
        THREE.MathUtils.clamp(world.speed / CLIP_SPEED, MIN_RATE, MAX_RATE),
      );
    }

    // Landing. The simulation does not announce it - it does not need to -
    // so the posture's own fall from "jump" is the signal.
    const inAir = player.posture === "jump";
    if (airborne.current && !inAir && world.status === "running") landing.current = 1;
    airborne.current = inAir;
    landing.current = Math.max(0, landing.current - delta * 4.5);

    // The two additive layers. Sprint follows the pace; the crouch is a
    // spike that decays. Neither is allowed over a slide, which is already
    // a full-body pose and does not want a lean added to it.
    const sprint = actions.sprint;
    if (sprint) {
      // Not zero at the start. The first stride of a run should already
      // look like someone committing to it; the pace then takes it the rest
      // of the way. A lean that only arrives at top speed arrives two
      // minutes into a game most people lose in thirty seconds.
      const wantLean =
        sliding || world.status !== "running" ? 0 : 0.45 + 0.55 * paceOf(world.speed);
      sprint.setEffectiveWeight(
        sprint.getEffectiveWeight() + (wantLean - sprint.getEffectiveWeight()) * Math.min(1, delta * 3),
      );
    }
    const crouch = actions.crouch;
    if (crouch) crouch.setEffectiveWeight(sliding ? 0 : landing.current);

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
