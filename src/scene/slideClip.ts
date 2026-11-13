import * as THREE from "three";

/**
 * A slide, authored on the rig in code because the pack does not ship one.
 *
 * Kenney's character comes with idle, run and jump. Everything else about
 * this game is procedural, so rather than download a second pack and gamble
 * on two skeletons matching, the slide is a handful of bone rotations keyed
 * into an `AnimationClip` at load time. It costs no bytes and it blends
 * through the same mixer as the clips that were exported.
 *
 * Rotations are **relative to the bind pose**. A bone's rest orientation is
 * part of how the character was modelled; writing absolute quaternions would
 * throw that away and fold the figure into a shape the artist never made.
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
