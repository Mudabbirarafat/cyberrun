import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LANE_X, SPAWN_AHEAD } from "../game/constants";
import { getWorld } from "../store";

/**
 * The road, its lane markings and the city either side.
 *
 * None of this is generated per frame. A fixed ring of buildings and stripes
 * is created once and then slid backwards as the player advances, wrapping
 * round when a piece falls behind. An endless runner that spawned geometry
 * would spend its whole budget in the garbage collector.
 */

const ROAD_LENGTH = SPAWN_AHEAD + 60;
const ROAD_WIDTH = 9.5;
const STRIPE_COUNT = 40;
const STRIPE_SPACING = 6;
const BUILDING_COUNT = 90;
const BUILDING_SPACING = 11;

const dummy = new THREE.Object3D();

export function Track() {
  const stripes = useRef<THREE.InstancedMesh>(null);
  const buildings = useRef<THREE.InstancedMesh>(null);

  // Heights and offsets fixed up front: a skyline that reshuffled itself as
  // you ran would read as flicker, not variety.
  const skyline = useMemo(() => {
    const out: { side: number; height: number; depth: number; offset: number; hue: number }[] = [];
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      // A cheap deterministic hash, so the same skyline comes back every load.
      const n = Math.sin(i * 12.9898) * 43758.5453;
      const r = n - Math.floor(n);
      const n2 = Math.sin(i * 78.233) * 12345.6789;
      const r2 = n2 - Math.floor(n2);
      out.push({
        side,
        height: 7 + r * 26,
        depth: 5 + r2 * 5,
        offset: 9 + r2 * 7,
        hue: r,
      });
    }
    return out;
  }, []);

  useFrame(() => {
    const distance = getWorld().distance;

    if (stripes.current) {
      const span = STRIPE_COUNT * STRIPE_SPACING;
      let index = 0;
      for (let lane = 0; lane < 2; lane++) {
        const x = (LANE_X[lane]! + LANE_X[lane + 1]!) / 2;
        for (let i = 0; i < STRIPE_COUNT; i++) {
          // Wrapping with a modulo on the travelled distance: the stripe that
          // leaves the back of the view is the one that appears at the front.
          const z = -(((i * STRIPE_SPACING - distance) % span) + span) % span;
          dummy.position.set(x, 0.02, z - 10);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          stripes.current.setMatrixAt(index++, dummy.matrix);
        }
      }
      stripes.current.count = index;
      stripes.current.instanceMatrix.needsUpdate = true;
    }

    if (buildings.current) {
      const span = BUILDING_COUNT * BUILDING_SPACING * 0.5;
      let index = 0;
      for (let i = 0; i < skyline.length; i++) {
        const b = skyline[i]!;
        const base = Math.floor(i / 2) * BUILDING_SPACING;
        const z = -(((base - distance) % span) + span) % span;
        dummy.position.set(b.side * b.offset, b.height / 2, z - 8);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.depth, b.height, b.depth);
        dummy.updateMatrix();
        buildings.current.setMatrixAt(index, dummy.matrix);
        buildings.current.setColorAt(
          index,
          new THREE.Color().setHSL(0.55 + b.hue * 0.18, 0.55, 0.12 + b.hue * 0.12),
        );
        index++;
      }
      buildings.current.count = index;
      buildings.current.instanceMatrix.needsUpdate = true;
      if (buildings.current.instanceColor) buildings.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -ROAD_LENGTH / 2 + 10]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
        <meshStandardMaterial color="#161b2e" roughness={0.8} metalness={0.15} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -ROAD_LENGTH / 2 + 10]}>
        <planeGeometry args={[220, ROAD_LENGTH]} />
        <meshStandardMaterial color="#070910" roughness={1} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (ROAD_WIDTH / 2), 0.18, -ROAD_LENGTH / 2 + 10]}>
          <boxGeometry args={[0.18, 0.36, ROAD_LENGTH]} />
          <meshStandardMaterial
            color="#19e6ff"
            emissive="#19e6ff"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      <instancedMesh ref={stripes} args={[undefined, undefined, STRIPE_COUNT * 2]}>
        <planeGeometry args={[0.14, 3]} />
        <meshStandardMaterial
          color="#9fb4d8"
          emissive="#2b3b5c"
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={buildings} args={[undefined, undefined, BUILDING_COUNT]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} metalness={0.35} />
      </instancedMesh>
    </group>
  );
}
