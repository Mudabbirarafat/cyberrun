import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PLAYER_RUN_HEIGHT, PLAYER_SLIDE_HEIGHT } from "../game/constants";
import { getWorld } from "../store";

/**
 * The runner: a low-poly figure with a real face on the front of its head.
 *
 * Nothing here decides anything. Position, posture and pace all come from the
 * simulation, and the one place the two are tied together is the slide: the
 * figure is scaled so its drawn height *is* the collision height, rather than
 * being a separate number that can drift away from it.
 *
 * Limbs rotate about a pivot group placed at the shoulder or hip, with the
 * mesh hung half its length below. Rotating the mesh itself would swing it
 * about its middle, which looks like a limb spinning rather than hinging.
 */

// Proportions, in world units, summing to PLAYER_RUN_HEIGHT.
const LEG = 0.56;
const TORSO = 0.6;
// Deliberately out of proportion: a realistic head is a seventh of a figure
// and at this distance that is a few pixels. This is the only place the face
// appears, so it gets the room.
const HEAD = 0.54;
const SHOULDER = LEG + TORSO - 0.08;
const ARM = 0.55;

/**
 * The window of `face.jpg` that holds the face, in UV.
 *
 * Cropping here rather than shipping a second, pre-cut image: the photo is
 * the only binary in the repository and this keeps it that way. UV origin is
 * bottom-left, which is why the vertical offset is measured up from the
 * bottom rather than down from the top.
 */
const FACE_OFFSET = new THREE.Vector2(0.273, 0.544);
const FACE_REPEAT = new THREE.Vector2(0.508, 0.358);

export function Player() {
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const shield = useRef<THREE.Mesh>(null);

  const face = useTexture("/face.jpg");

  // An effect, not a memo. React is free to throw a useMemo cache away and
  // run the callback again, and it is documented as being for computing a
  // value rather than for reaching out and changing one; configuring the
  // texture there happened to work only because the callback is idempotent.
  // This runs before the first paint, which is early enough: R3F draws on
  // the next animation frame, after commit.
  useLayoutEffect(() => {
    face.colorSpace = THREE.SRGBColorSpace;
    face.offset.copy(FACE_OFFSET);
    face.repeat.copy(FACE_REPEAT);
    // Clamping, so the crop cannot tile a sliver of shoulder round the edge.
    face.wrapS = THREE.ClampToEdgeWrapping;
    face.wrapT = THREE.ClampToEdgeWrapping;
    face.needsUpdate = true;
  }, [face]);

  useFrame((_, delta) => {
    const world = getWorld();
    const player = world.player;
    if (!root.current) return;

    root.current.position.x = player.x;
    root.current.position.y = player.y;

    const sliding = player.posture === "slide";
    const height = sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_RUN_HEIGHT;

    // The figure is built at full height, so scaling by the ratio makes the
    // silhouette and the collision box the same thing by construction.
    const squash = height / PLAYER_RUN_HEIGHT;
    root.current.scale.y += (squash - root.current.scale.y) * Math.min(1, delta * 18);

    // Leaning into a lane change, tipping forward in the air, diving on a
    // slide. `lean` is how far the eased x still is from the target lane.
    const targetX = (player.lane - 1) * 2.4;
    const lean = THREE.MathUtils.clamp((player.x - targetX) * -0.4, -0.45, 0.45);
    root.current.rotation.z = lean;
    const pitch = sliding ? -0.5 : player.posture === "jump" ? -0.2 : 0;
    root.current.rotation.x += (pitch - root.current.rotation.x) * Math.min(1, delta * 14);

    // At the end of a run the figure turns to face the camera, which is the
    // only moment you can see the face at all - the rest of the time you are
    // looking at the back of their head, as you would be.
    const facing = world.status === "over" ? Math.PI : 0;
    root.current.rotation.y += (facing - root.current.rotation.y) * Math.min(1, delta * 3.5);

    // A two-beat cycle driven by distance, so the stride speeds up with the
    // world instead of with the frame rate. Frozen mid-slide: limbs tucked.
    const cadence = sliding || world.status !== "running" ? 0 : Math.sin(world.distance * 1.5);
    const swing = cadence * 0.75;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    // Arms counter the legs, which is what makes a run read as a run.
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.8;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.8;
    if (bob.current) bob.current.position.y = Math.abs(cadence) * 0.045;

    if (shield.current) {
      shield.current.visible = world.shieldRemaining > 0;
      if (shield.current.visible) {
        shield.current.scale.setScalar(1 + Math.sin(world.time * 9) * 0.05);
      }
    }
  });

  return (
    <group ref={root}>
      <group ref={bob}>
        {/* Head. BoxGeometry groups run +X, -X, +Y, -Y, +Z, -Z, and the
            runner faces -Z, so the photo goes on material-5 and the camera
            sees material-4: the back of their head. */}
        <mesh position={[0, LEG + TORSO + HEAD / 2, 0]} castShadow>
          <boxGeometry args={[HEAD, HEAD, HEAD * 0.86]} />
          <meshStandardMaterial attach="material-0" color="#2b1d16" roughness={0.9} />
          <meshStandardMaterial attach="material-1" color="#2b1d16" roughness={0.9} />
          <meshStandardMaterial attach="material-2" color="#20150f" roughness={0.95} />
          <meshStandardMaterial attach="material-3" color="#8d6448" roughness={0.9} />
          <meshStandardMaterial attach="material-4" color="#241812" roughness={0.95} />
          <meshStandardMaterial attach="material-5" map={face} roughness={0.75} />
        </mesh>

        <mesh position={[0, LEG + TORSO / 2, 0]} castShadow>
          <boxGeometry args={[0.72, TORSO, 0.4]} />
          <meshStandardMaterial
            color="#167d9c"
            emissive="#17a8c9"
            emissiveIntensity={0.45}
            roughness={0.45}
            metalness={0.25}
          />
        </mesh>

        <group ref={leftArm} position={[-0.45, SHOULDER, 0]}>
          <mesh position={[0, -ARM / 2, 0]} castShadow>
            <boxGeometry args={[0.17, ARM, 0.19]} />
            <meshStandardMaterial color="#a4785a" emissive="#3d2415" emissiveIntensity={0.35} roughness={0.8} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.45, SHOULDER, 0]}>
          <mesh position={[0, -ARM / 2, 0]} castShadow>
            <boxGeometry args={[0.17, ARM, 0.19]} />
            <meshStandardMaterial color="#a4785a" emissive="#3d2415" emissiveIntensity={0.35} roughness={0.8} />
          </mesh>
        </group>

        <group ref={leftLeg} position={[-0.17, LEG, 0]}>
          <mesh position={[0, -LEG / 2, 0]} castShadow>
            <boxGeometry args={[0.22, LEG, 0.24]} />
            <meshStandardMaterial color="#2a4f7d" emissive="#12354f" emissiveIntensity={0.5} roughness={0.6} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.17, LEG, 0]}>
          <mesh position={[0, -LEG / 2, 0]} castShadow>
            <boxGeometry args={[0.22, LEG, 0.24]} />
            <meshStandardMaterial color="#1e3a5f" roughness={0.7} />
          </mesh>
        </group>
      </group>

      <mesh ref={shield} visible={false} position={[0, PLAYER_RUN_HEIGHT / 2, 0]}>
        <sphereGeometry args={[1.15, 20, 16]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={0.5}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
