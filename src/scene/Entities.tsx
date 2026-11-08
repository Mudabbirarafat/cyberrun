import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BARRIER_HEIGHT,
  LANE_X,
  OBSTACLE_HALF_WIDTH,
  OVERHEAD_CLEARANCE,
} from "../game/constants";
import type { ObstacleKind, PowerKind } from "../game/types";
import { getWorld } from "../store";

/**
 * Everything on the track, drawn as five instanced meshes.
 *
 * A run holds a few dozen live entities and recycles them constantly. Giving
 * each one a React component would mean mounting and unmounting meshes at
 * speed; instancing means the count changes and nothing is created. The
 * shapes deliberately match the collision boxes in `constants.ts` - a barrier
 * is drawn exactly as high as the height you must clear, so what you see is
 * what you hit.
 */

const MAX = 96;
const dummy = new THREE.Object3D();

const POWER_COLOUR: Record<PowerKind, string> = {
  shield: "#4ade80",
  magnet: "#f472b6",
  slow: "#60a5fa",
};

function useInstances() {
  return useRef<THREE.InstancedMesh>(null);
}

export function Entities() {
  const barriers = useInstances();
  const overheads = useInstances();
  const blocks = useInstances();
  const coins = useInstances();
  const powers = useInstances();

  useFrame((_, delta) => {
    const world = getWorld();
    const counts = { barrier: 0, overhead: 0, block: 0, coin: 0, power: 0 };

    const write = (
      mesh: THREE.InstancedMesh | null,
      index: number,
      x: number,
      y: number,
      z: number,
      rotation = 0,
      colour?: THREE.Color,
    ) => {
      if (!mesh || index >= MAX) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, rotation);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (colour) mesh.setColorAt(index, colour);
    };

    const spin = world.time * 2.4;

    for (const entity of world.entities) {
      // Spent entities are kept until they are recycled so the arrays stay
      // stable, but a collected coin should not still be sitting there.
      if (entity.spent) continue;
      const z = -(entity.z - world.distance);
      if (z > 6 || z < -(220)) continue;
      const x = LANE_X[entity.lane]!;

      if (entity.kind === "obstacle") {
        const kind = entity.obstacle as ObstacleKind;
        if (kind === "barrier") {
          write(barriers.current, counts.barrier++, x, BARRIER_HEIGHT / 2, z);
        } else if (kind === "overhead") {
          // Hangs from above, its underside at the clearance height.
          write(
            overheads.current,
            counts.overhead++,
            x,
            OVERHEAD_CLEARANCE + 0.9,
            z,
          );
        } else {
          write(blocks.current, counts.block++, x, 1.1, z);
        }
        continue;
      }

      if (entity.kind === "coin") {
        write(coins.current, counts.coin++, x, 0.95, z, spin);
        continue;
      }

      write(
        powers.current,
        counts.power++,
        x,
        1.15 + Math.sin(world.time * 3 + entity.id) * 0.12,
        z,
        spin,
        new THREE.Color(POWER_COLOUR[entity.power ?? "shield"]),
      );
    }

    void delta;

    const commit = (mesh: THREE.InstancedMesh | null, count: number) => {
      if (!mesh) return;
      mesh.count = Math.min(count, MAX);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    commit(barriers.current, counts.barrier);
    commit(overheads.current, counts.overhead);
    commit(blocks.current, counts.block);
    commit(coins.current, counts.coin);
    commit(powers.current, counts.power);
  });

  const width = OBSTACLE_HALF_WIDTH * 2;

  return (
    <group>
      <instancedMesh ref={barriers} args={[undefined, undefined, MAX]} castShadow>
        <boxGeometry args={[width, BARRIER_HEIGHT, 0.7]} />
        <meshStandardMaterial
          color="#ff2d6f"
          emissive="#ff2d6f"
          emissiveIntensity={0.7}
          roughness={0.4}
        />
      </instancedMesh>

      <instancedMesh ref={overheads} args={[undefined, undefined, MAX]} castShadow>
        <boxGeometry args={[width, 1.8, 0.7]} />
        <meshStandardMaterial
          color="#ffb020"
          emissive="#ffb020"
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </instancedMesh>

      <instancedMesh ref={blocks} args={[undefined, undefined, MAX]} castShadow>
        <boxGeometry args={[width, 2.2, 0.8]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={0.5}
          roughness={0.35}
          metalness={0.3}
        />
      </instancedMesh>

      <instancedMesh ref={coins} args={[undefined, undefined, MAX]}>
        <torusGeometry args={[0.32, 0.12, 8, 18]} />
        <meshStandardMaterial
          color="#ffd34d"
          emissive="#ffb400"
          emissiveIntensity={1.1}
          metalness={0.7}
          roughness={0.25}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={powers} args={[undefined, undefined, MAX]}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial
          emissive="#ffffff"
          emissiveIntensity={0.55}
          metalness={0.4}
          roughness={0.2}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
