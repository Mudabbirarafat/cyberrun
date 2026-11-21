import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { menace } from "../game/hunter";
import { getWorld } from "../store";

/**
 * The thing behind you, drawn.
 *
 * The geometry here needs explaining, because the obvious version is wrong.
 * The camera sits about ten units behind the player looking forward, so
 * "behind the player" is the space between the player and the lens. Draw the
 * hunter at its true gap and a distant one is *on top of the camera*, filling
 * the frame, while one about to catch you is next to the player and small.
 * Closing would make it shrink.
 *
 * So it is only drawn once it is inside `VISIBLE_GAP`, and `CameraRig` eases
 * back as the menace rises to keep both it and the runner in shot. The read
 * the player gets is then hunter-against-runner rather than
 * hunter-against-lens, which is the comparison that actually means something.
 *
 * Everything it does is a function of `menace()`, so the simulation stays the
 * only thing that decides anything and this file only decides how it looks.
 */

/** Closer than this and it is on camera. Purely a render threshold. */
const VISIBLE_GAP = 5.5;

/**
 * Lighter than the obstacles' near-black, and it has to be.
 *
 * The obstacles get away with being almost pure black because they pass
 * through the two rim lights sitting either side of the runner. The hunter
 * is behind all of that, in the one part of the scene nothing lights, so the
 * same colour there is not a dark shape - it is no shape at all, and the
 * first build of this read as a hollow red ring with nothing inside it.
 */
const BODY = "#2b0a14";
const RIM = "#ff2d55";
const EYE = "#ff4d4d";
/** Radius. Smaller than it looks it should be: it is nearer the camera than
 *  the runner is, so it is magnified relative to them before anything else. */
const SIZE = 0.6;

export function Hunter() {
  const group = useRef<THREE.Group>(null);
  const rim = useRef<THREE.Mesh>(null);
  const left = useRef<THREE.MeshBasicMaterial>(null);
  const right = useRef<THREE.MeshBasicMaterial>(null);
  /** Lags the player's lane, so it reads as chasing rather than strafing. */
  const x = useRef(0);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    const world = getWorld();
    const hunter = world.hunter;

    // Off camera and not worth a draw call. Everything below is skipped for
    // the whole of a clean run, which is most of most runs.
    const visible = hunter.gap < VISIBLE_GAP && world.status !== "ready";
    node.visible = visible;
    if (!visible) return;

    const fear = menace(hunter);

    // It follows the lane change late. Matching the runner exactly would
    // look like a towed trailer; arriving a beat behind looks like pursuit.
    x.current += (world.player.x - x.current) * Math.min(1, delta * 3.4);
    node.position.x = x.current;
    node.position.z = hunter.gap;

    // Loping rather than gliding, and faster the closer it is. The vertical
    // bob is what sells it as a thing with legs without animating any.
    const lope = Math.sin(world.time * (7 + fear * 6));
    // Height rides the gap, which is not decoration - it is the only way to
    // keep the thing in shot at all.
    //
    // The hunter is between the runner and the lens, so a *large* gap puts
    // it nearest the camera and lowest in frame, and a small one carries it
    // back towards the runner and up. Left at a fixed height it falls out of
    // the bottom of the picture the moment it appears and then climbs onto
    // the runner's head as it arrives. Lifting it when it is far and
    // dropping it as it closes cancels that out: it holds roughly one place
    // on screen, under the runner, and what changes is how much of the frame
    // it takes up.
    node.position.y = 0.28 + hunter.gap * 0.13 + lope * (0.12 + fear * 0.1);
    node.rotation.z = lope * 0.06;
    // Leaning in as it closes.
    node.rotation.x = -0.1 - fear * 0.22;

    const size = 1 + fear * 0.3;
    node.scale.set(size, size, size);

    if (rim.current) {
      // The rim is the only part that really brightens. The body stays near
      // black so bloom has something to catch hold of.
      const material = rim.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.5 + fear * 0.5;
    }

    // Eyes pulse, out of phase with the lope so the whole thing does not
    // throb in time with itself.
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 11);
    const glow = 1.2 + fear * 2.8 * pulse;
    if (left.current) left.current.color.setScalar(glow);
    if (right.current) right.current.color.setScalar(glow);
  });

  return (
    <group ref={group} visible={false}>
      {/* Body: low-poly and squat, so it never resolves into anything you
          can look at properly. Whatever the player decides it is will be
          worse than anything modelled here. */}
      <mesh castShadow scale={[1.15, 0.85, 1.3]}>
        <icosahedronGeometry args={[SIZE, 1]} />
        <meshStandardMaterial
          color={BODY}
          roughness={0.85}
          metalness={0.1}
          // A little of its own light, because nothing else out here will
          // give it any.
          emissive="#50000f"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* The same trick the obstacles use: a slightly larger copy with its
          faces flipped inwards, so only the sliver past the body shows and
          the silhouette gets a hard edge for one extra draw. Thin, or it
          stops being an outline and becomes a ring. */}
      <mesh ref={rim} scale={[1.19, 0.88, 1.34]}>
        <icosahedronGeometry args={[SIZE, 1]} />
        <meshBasicMaterial color={RIM} side={THREE.BackSide} transparent opacity={0.6} />
      </mesh>

      {/* Spikes along the back, as one stretched shape rather than several:
          at this distance and this speed the count is not readable. */}
      <mesh position={[0, 0.42, 0.15]} rotation={[0.3, 0, 0]} scale={[0.8, 1.4, 0.5]}>
        <tetrahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={BODY} roughness={0.9} emissive="#3a000b" />
      </mesh>

      {/* On the side facing the camera, not the side facing where it is
          running. Anatomically it should be looking ahead at the runner;
          from behind that puts both eyes permanently out of shot, and a
          thing with no eyes is a blob. It looking back at you is also
          worse, which is the point. */}
      <mesh position={[-0.2, 0.14, 0.5]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial ref={left} color={EYE} toneMapped={false} />
      </mesh>
      <mesh position={[0.2, 0.14, 0.5]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial ref={right} color={EYE} toneMapped={false} />
      </mesh>

      {/* In front of it, on the camera's side, so it lights the face you
          can actually see. Behind it, the first version lit the half of the
          model nobody ever looks at. */}
      <pointLight position={[0, 0.5, 1.1]} color={RIM} intensity={7} distance={5} />
    </group>
  );
}
