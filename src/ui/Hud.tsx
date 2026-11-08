import { useGame } from "../store";
import "./hud.css";

/**
 * Everything that is read rather than played.
 *
 * Each piece subscribes to one slice of the store, so a coin does not
 * re-render the game-over panel. None of this is inside the Canvas: text in
 * WebGL costs a texture atlas and reads worse at every size.
 */

function Powers() {
  const shield = useGame((state) => state.shield);
  const magnet = useGame((state) => state.magnet);
  const slow = useGame((state) => state.slow);

  return (
    <div className="powers" aria-live="polite">
      {shield && <span className="power power-shield">Shield</span>}
      {magnet && <span className="power power-magnet">Magnet</span>}
      {slow && <span className="power power-slow">Slow</span>}
    </div>
  );
}

function Score() {
  const score = useGame((state) => state.score);
  const coins = useGame((state) => state.coins);
  const highScore = useGame((state) => state.highScore);

  return (
    <div className="score-panel">
      <div className="score">{score.toLocaleString()}</div>
      <div className="meta">
        <span className="coins">◎ {coins}</span>
        <span className="best">Best {highScore.toLocaleString()}</span>
      </div>
    </div>
  );
}

function Ready() {
  return (
    <div className="overlay">
      <div className="panel">
        <h1>
          Cyber<span>Run</span>
        </h1>
        <p className="tagline">Three lanes. One mistake.</p>
        <ul className="keys">
          <li>
            <kbd>←</kbd> <kbd>→</kbd> change lane
          </li>
          <li>
            <kbd>↑</kbd> / <kbd>Space</kbd> jump the red barriers
          </li>
          <li>
            <kbd>↓</kbd> slide under the amber ones
          </li>
          <li>Purple blocks fill the lane — go round</li>
        </ul>
        <p className="touch">On a phone: swipe to move, tap to jump.</p>
        <p className="prompt">Press anything to run</p>
      </div>
    </div>
  );
}

function GameOver() {
  const score = useGame((state) => state.score);
  const coins = useGame((state) => state.coins);
  const highScore = useGame((state) => state.highScore);
  const beatBest = useGame((state) => state.beatBest);
  const restart = useGame((state) => state.restart);

  return (
    <div className="overlay">
      <div className="panel">
        <h2>{beatBest ? "New best" : "Wiped out"}</h2>
        <div className="final">{score.toLocaleString()}</div>
        <div className="breakdown">
          <span>{coins} collected</span>
          <span>Best {highScore.toLocaleString()}</span>
        </div>
        <button type="button" onClick={restart} autoFocus>
          Run again
        </button>
        <p className="prompt subtle">or press any key</p>
      </div>
    </div>
  );
}

export function Hud() {
  const status = useGame((state) => state.status);

  return (
    <div className="hud">
      {status === "running" && (
        <>
          <Score />
          <Powers />
        </>
      )}
      {status === "ready" && <Ready />}
      {status === "over" && <GameOver />}
    </div>
  );
}
