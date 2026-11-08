import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getWorld } from "../store";

/**
 * A burst of sparks where the run ended.
 *
 * Allocated once and reused: the buffers are created at mount and refilled on
 * each crash, so a particle effect never allocates during play. Without that,
 * every death would hand the collector a few hundred objects at exactly the
 * moment the camera is shaking and the frame budget is tightest.
 *
 * It reads the world rather than being told about the crash, for the same
 * reason everything else here does - the simulation has no idea it is being
 * drawn.
 */

const COUNT = 140;
const GRAVITY = -16;
const LIFETIME = 1.4;

export function Sparks() {
  const points = useRef<THREE.Points>(null);
  const wasOver = useRef(false);
  const age = useRef(Infinity);

  const { positions, velocities, geometry } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { positions, velocities, geometry };
  }, []);

  useFrame((_, delta) => {
    const world = getWorld();
    const over = world.status === "over";

    if (over && !wasOver.current) {
      // Fresh crash: scatter from the runner's chest, upward and outward.
      const px = world.player.x;
      const py = world.player.y + 0.9;
      for (let i = 0; i < COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 7.5;
        const lift = 0.35 + Math.random() * 0.95;
        positions[i * 3] = px + (Math.random() - 0.5) * 0.35;
        positions[i * 3 + 1] = py + (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
        velocities[i * 3] = Math.cos(theta) * speed * 0.55;
        velocities[i * 3 + 1] = lift * speed * 0.6;
        velocities[i * 3 + 2] = Math.sin(theta) * speed * 0.5 + 3.5;
      }
      age.current = 0;
    }
    wasOver.current = over;

    if (age.current >= LIFETIME) {
      if (points.current) points.current.visible = false;
      return;
    }

    age.current += delta;
    const step = Math.min(delta, 1 / 30);

    for (let i = 0; i < COUNT; i++) {
      velocities[i * 3 + 1] += GRAVITY * step;
      positions[i * 3] += velocities[i * 3] * step;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * step;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * step;
      // Bounce once off the road, losing most of the energy.
      if (positions[i * 3 + 1] < 0.04) {
        positions[i * 3 + 1] = 0.04;
        velocities[i * 3 + 1] *= -0.32;
      }
    }

    if (points.current) {
      points.current.visible = true;
      const material = points.current.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 1 - age.current / LIFETIME);
      geometry.attributes.position!.needsUpdate = true;
    }
  });

  return (
    <points ref={points} geometry={geometry} visible={false} frustumCulled={false}>
      <pointsMaterial
        size={0.14}
        color="#ffb86b"
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
