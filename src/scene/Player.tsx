import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_RUN_HEIGHT, PLAYER_SLIDE_HEIGHT } from "../game/constants";
import { getWorld } from "../store";

/** How much of the runner is leg. Visual only - collision uses the total. */
const LEG_HEIGHT = 0.5;

/**
 * The runner.
 *
 * Position comes straight from the simulation - this component decides
 * nothing. Squashing on a slide is done by scaling to the collision height
 * that `world.ts` actually uses, so the figure that fits under an overhead is
 * the figure you can see fitting.
 */
export function Player() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const world = getWorld();
    const player = world.player;
    if (!group.current) return;

    group.current.position.x = player.x;
    group.current.position.y = player.y;

    // Leaning into a lane change, and tipping forward in the air.
    const lean = THREE.MathUtils.clamp((player.x - (player.lane - 1) * 2.4) * -0.35, -0.4, 0.4);
    group.current.rotation.z = lean;
    group.current.rotation.x = player.posture === "jump" ? -0.18 : 0;

    const sliding = player.posture === "slide";
    const height = sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_RUN_HEIGHT;

    // The torso sits on top of the legs rather than through them. Written
    // the other way round first, the legs were inside the body mesh and
    // animated where nobody could see them.
    const legs = sliding ? 0 : LEG_HEIGHT;
    const torso = height - legs;
    if (body.current) {
      // Scale, not a swap: the mesh is a unit box, so torso + legs is
      // literally the collision height.
      body.current.scale.set(1, torso, 1);
      body.current.position.y = legs + torso / 2;
    }

    // A two-beat run cycle, faster as the world speeds up. Frozen mid-slide,
    // because the legs are tucked.
    const cadence = sliding ? 0 : Math.sin(world.distance * 1.6) * 0.5;
    if (leftLeg.current) leftLeg.current.rotation.x = cadence;
    if (rightLeg.current) rightLeg.current.rotation.x = -cadence;
    if (leftLeg.current) leftLeg.current.visible = !sliding;
    if (rightLeg.current) rightLeg.current.visible = !sliding;

    if (shield.current) {
      shield.current.visible = world.shieldRemaining > 0;
      if (shield.current.visible) {
        const pulse = 1 + Math.sin(world.time * 9) * 0.05;
        shield.current.scale.setScalar(pulse);
        shield.current.position.y = height / 2;
      }
    }
  });

  return (
    <group ref={group}>
      <mesh ref={body} castShadow>
        <boxGeometry args={[0.8, 1, 0.8]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#0891b2"
          emissiveIntensity={0.7}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      <mesh ref={leftLeg} position={[-0.2, LEG_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.26, LEG_HEIGHT, 0.26]} />
        <meshStandardMaterial color="#0e7490" roughness={0.5} />
      </mesh>
      <mesh ref={rightLeg} position={[0.2, LEG_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.26, LEG_HEIGHT, 0.26]} />
        <meshStandardMaterial color="#0e7490" roughness={0.5} />
      </mesh>

      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[1.1, 20, 16]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={0.5}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
