import { useEffect, useRef } from "react";
import { COMBO_WINDOW } from "../game/constants";
import { describe as describeMission } from "../game/missions";
import { getWorld, useGame } from "../store";
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

/**
 * The multiplier, and how long is left to keep it.
 *
 * The number comes from the store because it steps rarely. The bar does not:
 * the seconds remaining change 120 times a second, and routing that through
 * React to animate a width would re-render the HUD at the simulation's rate
 * for one div. It is read off the world in an animation frame and written
 * straight to the element instead.
 */
/**
 * Mute, which exists because the game now talks.
 *
 * A fixed control rather than a key-only binding: a player who wants the
 * voice to stop wants it to stop now, and hunting for the right letter
 * while it is talking is not that.
 */
function SoundToggle() {
  const muted = useGame((state) => state.muted);
  const toggle = useGame((state) => state.toggleMuted);

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? "Unmute" : "Mute"}
      title={muted ? "Unmute (M)" : "Mute (M)"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

function Paused() {
  const toggle = useGame((state) => state.togglePaused);

  return (
    <div className="overlay">
      <div className="panel">
        <h2>Paused</h2>
        <button type="button" onClick={toggle} autoFocus>
          Resume
        </button>
        <p className="prompt subtle">or press any key</p>
      </div>
    </div>
  );
}

function Combo() {
  const multiplier = useGame((state) => state.multiplier);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (multiplier <= 1) return;
    let frame = 0;
    const paint = () => {
      const left = Math.max(0, Math.min(1, getWorld().comboRemaining / COMBO_WINDOW));
      if (bar.current) bar.current.style.transform = `scaleX(${left})`;
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [multiplier]);

  if (multiplier <= 1) return null;

  return (
    // `key` so the pop animation replays on every step up rather than only
    // the first: React would otherwise keep the element and the class.
    <div className="combo" key={multiplier} aria-live="off">
      <span className="combo-x">&times;{multiplier}</span>
      <div className="combo-track">
        <div className="combo-fill" ref={bar} />
      </div>
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

/**
 * The three goals, and how far along they are.
 *
 * Shown on the panels rather than during a run: a goal is something you
 * decide to chase before you start or after you stop, and a third bar on
 * screen while you are dodging is one thing too many to read.
 */
function Missions() {
  const missions = useGame((state) => state.missions);
  const completed = useGame((state) => state.completedMissions);
  const justDone = new Set(completed.map((mission) => mission.id));

  return (
    <div className="missions">
      <div className="missions-head">Level {missions.level}</div>
      <ul>
        {missions.missions.map((mission) => {
          const fraction = Math.min(1, mission.progress / mission.target);
          const done = mission.done || justDone.has(mission.id);
          return (
            <li key={mission.id} className={done ? "mission done" : "mission"}>
              <div className="mission-row">
                <span className="mission-label">{describeMission(mission)}</span>
                <span className="mission-count">
                  {done ? "done" : `${Math.floor(mission.progress)}/${mission.target}`}
                </span>
              </div>
              <div className="mission-track">
                <div className="mission-fill" style={{ width: `${fraction * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
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
          <li>
            <kbd>Esc</kbd> pause · <kbd>M</kbd> mute
          </li>
        </ul>
        <p className="touch">On a phone: swipe to move, tap to jump.</p>
        <Missions />
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
  const bestCombo = useGame((state) => state.bestCombo);
  const nearMisses = useGame((state) => state.nearMisses);
  const levelledUp = useGame((state) => state.levelledUp);
  const missions = useGame((state) => state.missions);
  const crashLine = useGame((state) => state.crashLine);
  const restart = useGame((state) => state.restart);

  return (
    <div className="overlay">
      <div className="panel">
        {/* The runner turns to face the camera on a crash, but at that
            distance the head is a few pixels. This is the same photo, big
            enough to be a face. */}
        <div className="avatar">
          <img src="/face.jpg" alt="" aria-hidden="true" />
        </div>
        <h2>{beatBest ? "New best" : "Wiped out"}</h2>
        <div className="final">{score.toLocaleString()}</div>
        {/* Written as well as spoken. Most tabs are muted, and a joke that
            only exists as audio is no joke at all on a silent one. */}
        {crashLine && <p className="crash-line">{crashLine}</p>}
        <div className="breakdown">
          <span>{coins} collected</span>
          <span>Best {highScore.toLocaleString()}</span>
        </div>
        {/* What the run was made of, rather than only what it came to.
            A chain of 20 and nine near misses is a different run from the
            same score made of distance alone. */}
        <div className="breakdown subtle-row">
          <span>Longest chain {bestCombo}</span>
          <span>
            {nearMisses} near {nearMisses === 1 ? "miss" : "misses"}
          </span>
        </div>
        {levelledUp && <p className="levelled">All three done — level {missions.level}</p>}
        <Missions />
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
  const paused = useGame((state) => state.paused);

  return (
    <div className="hud">
      {status === "running" && (
        <>
          <Score />
          <Combo />
          <Powers />
        </>
      )}
      {status === "ready" && <Ready />}
      {status === "running" && paused && <Paused />}
      {status === "over" && <GameOver />}
      {/* Last, so it paints over the overlays. Muting matters most while
          the game is talking at you, which is exactly when the game-over
          panel is covering the screen. */}
      <SoundToggle />
    </div>
  );
}
