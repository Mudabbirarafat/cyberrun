import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { MAX_SPEED, START_SPEED } from "../game/constants";
import { getWorld } from "../store";

/**
 * What turns flat emissive colours into neon.
 *
 * Bloom is doing nearly all of the work. The threshold sits low so the rails,
 * coins and obstacle strips bleed, while the dark bodies and the road stay
 * where they are - that contrast between a black surface and a blown-out edge
 * is the whole look. Materials that should glow are marked `toneMapped={false}`
 * so their colour survives tone mapping and arrives above the threshold.
 *
 * Chromatic aberration is kept far below where it would read as an effect;
 * at this strength it only softens the edges of the frame. It leans harder as
 * the run speeds up, which is cheaper and more legible than motion blur.
 */

const BASE_ABERRATION = 0.0006;

export function Effects() {
  const aberration = useRef<{ offset: THREE.Vector2 }>(null);

  useFrame(() => {
    if (!aberration.current) return;
    const world = getWorld();
    const pace = THREE.MathUtils.clamp(
      (world.speed - START_SPEED) / (MAX_SPEED - START_SPEED),
      0,
      1,
    );
    const amount = BASE_ABERRATION + pace * 0.0016;
    aberration.current.offset.set(amount, amount * 0.6);
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={1.5}
        // Low, because almost everything that should glow is emissive and
        // almost everything else is close to black.
        luminanceThreshold={0.22}
        luminanceSmoothing={0.5}
        mipmapBlur
        // Half resolution: the result is blurred, so the pixels thrown away
        // here are ones nobody can see, and it is the difference between
        // 18fps and a playable frame rate on a laptop.
        resolutionScale={0.5}
      />
      <ChromaticAberration
        ref={aberration as never}
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(BASE_ABERRATION, BASE_ABERRATION)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette offset={0.26} darkness={0.82} />
    </EffectComposer>
  );
}
