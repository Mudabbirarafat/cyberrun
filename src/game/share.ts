import { zoneAt, zoneLabel } from "./zones";

/**
 * The run, as something you can paste into a chat.
 *
 * A pure function of the numbers, so it is tested rather than eyeballed, and
 * so the clipboard code in the UI has no opinions in it.
 *
 * No emoji. A share string full of them is a share string that renders as
 * boxes somewhere, and the one place this text has to survive is somebody
 * else's phone.
 */

export interface ShareResult {
  score: number;
  distance: number;
  coins: number;
  bestCombo: number;
  nearMisses: number;
  /** The hunter got you, rather than a wall. */
  caught: boolean;
  /** Present on a daily run, absent on an endless one. */
  day?: string;
}

/** Segments in the distance bar, and what a full bar is worth. */
const BAR_SEGMENTS = 10;
const BAR_FULL_DISTANCE = 1500;

export function distanceBar(distance: number): string {
  if (!Number.isFinite(distance) || distance <= 0) return "▱".repeat(BAR_SEGMENTS);
  const filled = Math.min(
    BAR_SEGMENTS,
    Math.floor((distance / BAR_FULL_DISTANCE) * BAR_SEGMENTS),
  );
  return "▰".repeat(filled) + "▱".repeat(BAR_SEGMENTS - filled);
}

export function shareText(result: ShareResult, url = "cyberrun-tau.vercel.app"): string {
  const metres = Math.floor(Math.max(0, result.distance));
  const zone = zoneLabel(zoneAt(metres));

  const headline = result.day ? `CyberRun · daily ${result.day}` : "CyberRun";
  const ending = result.caught
    ? `caught at ${metres.toLocaleString("en-GB")} m`
    : `ran ${metres.toLocaleString("en-GB")} m`;

  // Only the facts that changed between runs. Listing every stat makes two
  // people's results look identical at a glance, which defeats the point of
  // pasting one at somebody.
  const stats = [
    `${result.score.toLocaleString("en-GB")} pts`,
    `${result.coins} coins`,
    `chain x${result.bestCombo}`,
  ];
  if (result.nearMisses > 0) stats.push(`${result.nearMisses} near misses`);

  return [headline, `${ending} · ${zone}`, stats.join(" · "), distanceBar(metres), url].join(
    "\n",
  );
}
