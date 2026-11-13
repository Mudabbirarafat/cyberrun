import * as THREE from "three";

/**
 * The animations the pack does not ship, authored on its own rig.
 *
 * Kenney's character comes with idle, run and jump. Rather than download a
 * second pack and gamble on two skeletons matching, the rig already loaded
 * gets posed: a slide, a sprint lean and a landing crouch, built as
 * `AnimationClip`s when the model loads. They cost no bytes and they go
 * through the same mixer as the exported clips.
 *
 * Rotations are **relative to the bind pose**. A bone's rest orientation is
 * part of how the character was modelled; writing absolute quaternions would
 * throw that away and fold the figure into a shape the artist never made.
 *
 * Two facts about this rig, both learned by getting them wrong and looking:
 * positive X *raises* an arm rather than lowering it, and the bind pose is a
 * T - so bringing the arms in to the body is a large Z rotation, not a small
 * one.
 *
 * The slide replaces the base clip. The sprint and the crouch are
 * **additive**: they are deltas layered on top of whatever is already
 * playing, so a sprint lean does not have to contain a run cycle and a
 * landing dip does not have to fight the state machine for control of the
 * legs.
 */

/** Bone, and how far to turn it from rest, in radians. */
interface Pose {
  [bone: string]: [x: number, y: number, z: number];
}

/**
 * Feet first, weight back, trailing leg tucked.
 *
 * The lead leg extends, the trailing knee folds under, the spine goes back
 * so the chest opens to the sky, and the arms swing behind for balance. The
 * head is counter-rotated so the runner is still looking where they are
 * going rather than at the ceiling.
 */
const SLIDE: Pose = {
  // Negative X reclines on this rig, which is how the whole body goes down
  // and back without the root group having to tip as well.
  Hips: [-0.78, 0, 0],
  Spine: [-0.2, 0, 0],
  Chest: [-0.12, 0, 0],
  // The head counter-rotates by nearly the whole hip angle: the runner is
  // still looking where they are going, not at the sky.
  Neck: [0.4, 0, 0],
  Head: [0.5, 0, 0],

  LeftUpLeg: [-0.55, 0, 0.12],
  LeftLeg: [0.45, 0, 0],
  LeftFoot: [0.3, 0, 0],

  RightUpLeg: [-0.1, 0, -0.1],
  RightLeg: [1.5, 0, 0],
  RightFoot: [0.25, 0, 0],

  // The bind pose is a T: the arms start straight out sideways, so bringing
  // them down to the body is a large Z rotation, not a small one. Getting
  // this wrong is what left the first two attempts looking like someone
  // falling over backwards with their arms out.
  LeftArm: [-0.35, 0, -1.25],
  LeftForeArm: [0, 0, -0.45],
  RightArm: [-0.35, 0, 1.25],
  RightForeArm: [0, 0, 0.45],
};

/**
 * A second pose, a few degrees away from the first.
 *
 * A single pose held for the length of a slide reads as a crash rather than
 * a slide: nothing on a moving body is still. These are small enough to be
 * a judder over bumpy ground rather than an animation in their own right.
 */
const JUDDER: Pose = {
  Hips: [-0.74, 0, 0.02],
  LeftLeg: [0.38, 0, 0],
  RightLeg: [1.42, 0, 0],
  LeftArm: [-0.28, 0, -1.3],
  RightArm: [-0.42, 0, 1.2],
};

const DURATION = 0.42;

function quaternionFor(rest: THREE.Quaternion, turn: [number, number, number]): number[] {
  const delta = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(turn[0], turn[1], turn[2], "XYZ"),
  );
  // Rest first: the delta is applied in the bone's own space, which is what
  // makes "bend the knee" mean the same thing whatever the bind pose was.
  const result = rest.clone().multiply(delta);
  return [result.x, result.y, result.z, result.w];
}

/**
 * Build the clip against a loaded character.
 *
 * Bones are looked up by name and missing ones are skipped rather than
 * thrown on: a different character with a different rig should lose the
 * slide pose, not the game.
 */
export function buildSlideClip(root: THREE.Object3D, name = "slide"): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  for (const [bone, turn] of Object.entries(SLIDE)) {
    const target = root.getObjectByName(bone);
    if (!target) continue;

    const rest = target.quaternion.clone();
    const held = quaternionFor(rest, turn);
    const away = quaternionFor(rest, JUDDER[bone] ?? turn);

    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${target.name}.quaternion`,
        [0, DURATION / 2, DURATION],
        [...held, ...away, ...held],
      ),
    );
  }

  return new THREE.AnimationClip(name, DURATION, tracks);
}

/**
 * Leaning into it, layered over the run.
 *
 * The chest drops and the head comes up, which is the shape of someone
 * chasing rather than jogging. Applied with a weight that follows the
 * world's speed, so the posture changes over a run rather than being a
 * setting.
 */
const SPRINT: Pose = {
  Hips: [0.2, 0, 0],
  Spine: [0.32, 0, 0],
  Chest: [0.22, 0, 0],
  // The neck undoes most of the chest, or the runner ends up studying the
  // tarmac rather than the lane ahead.
  Neck: [-0.38, 0, 0],
  Head: [-0.26, 0, 0],
  LeftArm: [0, 0, -0.3],
  LeftForeArm: [0, 0, -0.5],
  RightArm: [0, 0, 0.3],
  RightForeArm: [0, 0, 0.5],
};

/**
 * Absorbing a landing, layered over the run for a quarter of a second.
 *
 * Coming out of a jump straight back into a full stride is the single
 * thing that most makes a character look weightless. The knees take it.
 */
const CROUCH: Pose = {
  Hips: [0.2, 0, 0],
  Spine: [0.16, 0, 0],
  Chest: [0.1, 0, 0],
  Neck: [-0.2, 0, 0],
  LeftUpLeg: [-0.3, 0, 0],
  LeftLeg: [0.55, 0, 0],
  RightUpLeg: [-0.3, 0, 0],
  RightLeg: [0.55, 0, 0],
  LeftArm: [0, 0, -0.3],
  RightArm: [0, 0, 0.3],
};

/**
 * An additive clip: the pose as a delta from the bind pose.
 *
 * `makeClipAdditive` subtracts the clip's own first frame from every other
 * frame, so frame zero has to *be* the rest pose. Build it from one frame of
 * nothing and one frame of the pose, and what comes out is the difference -
 * which is the only thing an additive layer should carry.
 */
function additiveFrom(root: THREE.Object3D, pose: Pose, name: string): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  for (const [bone, turn] of Object.entries(pose)) {
    const target = root.getObjectByName(bone);
    if (!target) continue;

    const rest = target.quaternion.clone();
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${target.name}.quaternion`,
        [0, 1],
        [...quaternionFor(rest, [0, 0, 0]), ...quaternionFor(rest, turn)],
      ),
    );
  }

  const clip = new THREE.AnimationClip(name, 1, tracks);
  THREE.AnimationUtils.makeClipAdditive(clip);
  return clip;
}

/** The sprint lean, as an additive layer. Weight it by pace. */
export function buildSprintClip(root: THREE.Object3D, name = "sprint"): THREE.AnimationClip {
  return additiveFrom(root, SPRINT, name);
}

/** The landing dip, as an additive layer. Spike the weight, then decay it. */
export function buildCrouchClip(root: THREE.Object3D, name = "crouch"): THREE.AnimationClip {
  return additiveFrom(root, CROUCH, name);
}
