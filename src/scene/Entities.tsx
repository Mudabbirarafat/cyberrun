import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BARRIER_HEIGHT,
  LANE_X,
  OBSTACLE_HALF_WIDTH,
  OVERHEAD_CLEARANCE,
} from "../game/constants";
import type { PowerKind } from "../game/types";
import { getWorld } from "../store";

/**
 * Everything on the track, as instanced meshes.
 *
 * Each obstacle is drawn twice: a near-black body, and a slightly larger copy
 * with its faces flipped inwards. Only the parts of that larger copy sticking
 * out past the body are visible, which gives a hard emissive rim for nothing
 * but a second instanced draw - an outline pass or edge geometry would cost
 * far more. Against a black body, bloom turns that rim into neon.
 *
 * The shapes still match the collision boxes in `constants.ts`: a barrier is
 * exactly as high as the height you must clear, and an overhead's underside
 * sits exactly at the clearance you must get beneath.
 */

const MAX = 96;
const dummy = new THREE.Object3D();
const tint = new THREE.Color();

const POWER_COLOUR: Record<PowerKind, string> = {
  shield: "#4ade80",
  magnet: "#f472b6",
  slow: "#60a5fa",
};

/** How far the rim copy sticks out past the body. */
const RIM = { x: 1.04, y: 1.03, z: 1.06 };

export function Entities() {
  const barrierBody = useRef<THREE.InstancedMesh>(null);
  const barrierRim = useRef<THREE.InstancedMesh>(null);
  const overheadBody = useRef<THREE.InstancedMesh>(null);
  const overheadRim = useRef<THREE.InstancedMesh>(null);
  const blockBody = useRef<THREE.InstancedMesh>(null);
  const blockRim = useRef<THREE.InstancedMesh>(null);
  const coins = useRef<THREE.InstancedMesh>(null);
  const powers = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const world = getWorld();
    const counts = { barrier: 0, overhead: 0, block: 0, coin: 0, power: 0 };

    const write = (
      mesh: THREE.InstancedMesh | null,
      index: number,
      x: number,
      y: number,
      z: number,
      rim: boolean,
      spin = 0,
      colour?: THREE.Color,
    ) => {
      if (!mesh || index >= MAX) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, spin);
      if (rim) dummy.scale.set(RIM.x, RIM.y, RIM.z);
      else dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (colour) mesh.setColorAt(index, colour);
    };

    const spin = world.time * 2.4;

    for (const entity of world.entities) {
      if (entity.spent) continue;
      const z = -(entity.z - world.distance);
      if (z > 6 || z < -220) continue;
      const x = LANE_X[entity.lane]!;

      if (entity.kind === "obstacle") {
        if (entity.obstacle === "barrier") {
          const i = counts.barrier++;
          write(barrierBody.current, i, x, BARRIER_HEIGHT / 2, z, false);
          write(barrierRim.current, i, x, BARRIER_HEIGHT / 2, z, true);
        } else if (entity.obstacle === "overhead") {
          const i = counts.overhead++;
          write(overheadBody.current, i, x, OVERHEAD_CLEARANCE + 0.9, z, false);
          write(overheadRim.current, i, x, OVERHEAD_CLEARANCE + 0.9, z, true);
        } else {
          const i = counts.block++;
          write(blockBody.current, i, x, 1.1, z, false);
          write(blockRim.current, i, x, 1.1, z, true);
        }
        continue;
      }

      if (entity.kind === "coin") {
        write(coins.current, counts.coin++, x, 0.95, z, false, spin);
        continue;
      }

      tint.set(POWER_COLOUR[entity.power ?? "shield"]);
      write(
        powers.current,
        counts.power++,
        x,
        1.15 + Math.sin(world.time * 3 + entity.id) * 0.12,
        z,
        false,
        spin,
        tint,
      );
    }

    const commit = (mesh: THREE.InstancedMesh | null, count: number) => {
      if (!mesh) return;
      mesh.count = Math.min(count, MAX);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    commit(barrierBody.current, counts.barrier);
    commit(barrierRim.current, counts.barrier);
    commit(overheadBody.current, counts.overhead);
    commit(overheadRim.current, counts.overhead);
    commit(blockBody.current, counts.block);
    commit(blockRim.current, counts.block);
    commit(coins.current, counts.coin);
    commit(powers.current, counts.power);
  });

  const width = OBSTACLE_HALF_WIDTH * 2;

  return (
    <group>
      {/* Jump this one. */}
      <instancedMesh ref={barrierBody} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[width, BARRIER_HEIGHT, 0.6]} />
        <meshLambertMaterial color="#2d0b1c" emissive="#5e1030" emissiveIntensity={0.42} />
      </instancedMesh>
      <instancedMesh ref={barrierRim} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[width, BARRIER_HEIGHT, 0.6]} />
        <meshBasicMaterial color="#ff2d6f" side={THREE.BackSide} toneMapped={false} />
      </instancedMesh>

      {/* Slide under this one. */}
      <instancedMesh ref={overheadBody} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[width, 1.8, 0.6]} />
        <meshLambertMaterial color="#2e2206" emissive="#6b4a08" emissiveIntensity={0.42} />
      </instancedMesh>
      <instancedMesh ref={overheadRim} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[width, 1.8, 0.6]} />
        <meshBasicMaterial color="#ffb020" side={THREE.BackSide} toneMapped={false} />
      </instancedMesh>

      {/* Go round this one. */}
      <instancedMesh ref={blockBody} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[width, 2.2, 0.7]} />
        <meshLambertMaterial color="#20123a" emissive="#3f1d73" emissiveIntensity={0.45} />
      </instancedMesh>
      <instancedMesh ref={blockRim} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[width, 2.2, 0.7]} />
        <meshBasicMaterial color="#a855f7" side={THREE.BackSide} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={coins} args={[undefined, undefined, MAX]}>
        <torusGeometry args={[0.33, 0.1, 10, 22]} />
        <meshBasicMaterial color="#ffc233" toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={powers} args={[undefined, undefined, MAX]}>
        <octahedronGeometry args={[0.46, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
