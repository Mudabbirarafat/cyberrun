import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LANE_X, SPAWN_AHEAD } from "../game/constants";
import { getWorld } from "../store";

/**
 * The road, the rails and the city.
 *
 * Nothing is generated per frame. A fixed ring of stripes and buildings is
 * built once and slid backwards as the player advances, wrapping when a piece
 * falls behind, so an endless city costs the same as a finite one.
 *
 * The windows are a canvas texture rather than geometry. A skyline of lit
 * windows as meshes would be tens of thousands of quads for something the fog
 * eats within eighty units; as an emissive map it is one 256px canvas, drawn
 * once at startup, and bloom does the rest.
 */

const ROAD_LENGTH = SPAWN_AHEAD + 60;
const ROAD_WIDTH = 9.5;
const STRIPE_COUNT = 40;
const STRIPE_SPACING = 6;
const BUILDING_COUNT = 110;
const BUILDING_SPACING = 10;

const dummy = new THREE.Object3D();
const colour = new THREE.Color();

/** Deterministic hash, so the same skyline returns on every load. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function useWindowTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);

    const cols = 10;
    const rows = 16;
    const cellW = size / cols;
    const cellH = size / rows;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Most windows are dark. A block that is uniformly lit reads as a
        // texture swatch; one that is mostly off reads as a building at night.
        const lit = hash(x * 31 + y * 17);
        if (lit > 0.26) continue;
        const warmth = hash(x * 7 + y * 53);
        ctx.fillStyle =
          warmth > 0.72 ? "#ffd9a8" : warmth > 0.4 ? "#bfe9ff" : "#7aa6ff";
        ctx.globalAlpha = 0.45 + hash(x + y * 3) * 0.55;
        ctx.fillRect(x * cellW + 2, y * cellH + 2, cellW - 4, cellH - 5);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 5);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

export function Track() {
  const stripes = useRef<THREE.InstancedMesh>(null);
  const buildings = useRef<THREE.InstancedMesh>(null);
  const windows = useWindowTexture();

  const skyline = useMemo(() => {
    const out: { side: number; height: number; depth: number; offset: number; tint: number }[] = [];
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const a = hash(i);
      const b = hash(i * 2.7 + 11);
      out.push({
        side: i % 2 === 0 ? -1 : 1,
        height: 9 + a * 34,
        depth: 5 + b * 6,
        // Pushed back in a second row now and then, so the skyline has depth
        // rather than being a corridor of equal slabs.
        offset: 9 + b * 6 + (hash(i * 5.3) > 0.68 ? 9 : 0),
        tint: a,
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
          const z = -(((i * STRIPE_SPACING - distance) % span) + span) % span;
          dummy.position.set(x, 0.015, z - 10);
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
      const span = (BUILDING_COUNT / 2) * BUILDING_SPACING;
      for (let i = 0; i < skyline.length; i++) {
        const b = skyline[i]!;
        const base = Math.floor(i / 2) * BUILDING_SPACING;
        const z = -(((base - distance) % span) + span) % span;
        dummy.position.set(b.side * b.offset, b.height / 2, z - 8);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.depth, b.height, b.depth);
        dummy.updateMatrix();
        buildings.current.setMatrixAt(i, dummy.matrix);
        // Cool and nearly black: the windows supply the colour, the mass
        // supplies the silhouette.
        colour.setHSL(0.6 + b.tint * 0.1, 0.5, 0.035 + b.tint * 0.025);
        buildings.current.setColorAt(i, colour);
      }
      buildings.current.count = skyline.length;
      buildings.current.instanceMatrix.needsUpdate = true;
      if (buildings.current.instanceColor) buildings.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Road. Dark and smooth, so the rails have something to sit against. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -ROAD_LENGTH / 2 + 10]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
        <meshLambertMaterial color="#04050c" />
      </mesh>

      {/* Ground either side, darker still. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, -ROAD_LENGTH / 2 + 10]}>
        <planeGeometry args={[130, ROAD_LENGTH]} />
        <meshBasicMaterial color="#03040a" />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (ROAD_WIDTH / 2), 0.16, -ROAD_LENGTH / 2 + 10]}>
            <boxGeometry args={[0.14, 0.32, ROAD_LENGTH]} />
            <meshBasicMaterial color="#8ffaff" toneMapped={false} />
          </mesh>
          {/* The rail's reflection in the wet road. Additive and faint: a
              cheap stand-in for a reflection pass, which at this frame budget
              would cost a second render of the whole scene. */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[side * (ROAD_WIDTH / 2 - 0.55), 0.012, -ROAD_LENGTH / 2 + 10]}
          >
            <planeGeometry args={[1.1, ROAD_LENGTH]} />
            <meshBasicMaterial
              color="#19e6ff"
              transparent
              opacity={0.1}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      <instancedMesh ref={stripes} args={[undefined, undefined, STRIPE_COUNT * 2]}>
        <planeGeometry args={[0.1, 2.6]} />
        <meshBasicMaterial color="#5f7ea8" transparent opacity={0.5} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={buildings} args={[undefined, undefined, BUILDING_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial
          emissiveMap={windows ?? undefined}
          emissive="#ffffff"
          emissiveIntensity={0.85}
        />
      </instancedMesh>
    </group>
  );
}
