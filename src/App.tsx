import { Canvas } from "@react-three/fiber";
import { GameScene } from "./scene/GameScene";
import { Hud } from "./ui/Hud";
import { useControls } from "./useControls";

export default function App() {
  useControls();

  return (
    <>
      <Canvas
        shadows
        // Capped rather than uncapped: on a high-density display the default
        // renders four times the pixels, and this is a game that has to hold
        // a frame rate on a laptop, not a still that has to look sharp.
        dpr={[1, 1.25]}
        camera={{ position: [0, 4.7, 9.8], fov: 60, near: 0.1, far: 260 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <GameScene />
      </Canvas>
      <Hud />
    </>
  );
}
