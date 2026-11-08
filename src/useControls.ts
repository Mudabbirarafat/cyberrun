import { useEffect } from "react";
import { unlockAudio } from "./audio";
import type { Input } from "./game/types";
import { useGame } from "./store";

/**
 * Keyboard and touch, as one set of intentions.
 *
 * Both ends produce the same four inputs, so the simulation never learns
 * which device sent them. Audio is unlocked here and nowhere else, because
 * this is the only code that sees a real gesture - browsers refuse to start
 * an AudioContext without one.
 */

const KEYS: Record<string, Input> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  ArrowDown: "slide",
  KeyS: "slide",
};

/** Below this a swipe is a tap, and a tap means jump. */
const SWIPE_THRESHOLD = 26;

export function useControls(): void {
  useEffect(() => {
    const { send, start, restart } = useGame.getState();

    // Anything at all begins or restarts a run; only a running one takes
    // movement. Read from the store rather than a captured value, or the
    // first game over leaves the handler stuck on a stale status.
    const act = (input: Input) => {
      unlockAudio();
      const status = useGame.getState().status;
      if (status === "ready") {
        start();
        return;
      }
      if (status === "over") {
        restart();
        return;
      }
      send(input);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const input = KEYS[event.code];
      if (!input) return;
      // Space and the arrows scroll the page otherwise, which during a game
      // is the difference between playable and not.
      event.preventDefault();
      act(input);
    };

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
        act("jump");
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        act(dx > 0 ? "right" : "left");
      } else {
        act(dy > 0 ? "slide" : "jump");
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
}
