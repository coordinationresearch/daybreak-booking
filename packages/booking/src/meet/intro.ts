/**
 * The page's entrance, in two lengths. The first visit in an hour plays the
 * long one: the photo and title come in at the middle of the screen among
 * drifting blue dust, then glide up to their place as the dust gathers
 * into the page's open times, stars, meeting, and Book button, and each
 * part comes in out of its dust (MeetDust). A visit within the hour plays
 * the short one, the same arrival without the title's glide or the dust.
 * A long one plays at most once an hour.
 *
 * Either way the page waits at its first frame until it has drawn and
 * measured its Days (`data-entering="wait"`), so it never shows a guess at
 * how many Days fit and then jumps to the real count.
 */

/** Where the browser keeps when the long entrance last played. */
const INTRO_KEY = "daybreak-booking:intro";
/** The long entrance plays at most once in this long. */
const INTRO_EVERY_MS = 60 * 60 * 1000;
/** The long entrance's beats, from hydration. */
export const INTRO = {
  /** The title has come in at the middle and starts gliding up. */
  rise: 1150,
  /** It's in its place, and the facts under it start in:
   * `--intro-landed`. */
  landed: 2050,
  /** The rest of the page starts arriving, so each part is in just as
   * its dust lands, about when the title does: `--intro` in
   * meet.module.css. */
  rest: 1450,
  /** Everything's in; later Days and steps arrive their own way. */
  done: 3300,
} as const;

/** The short entrance's length: the cascade's last Day lands by then. */
export const ENTER_MS = 1600;

/**
 * Picks the long entrance when it hasn't played in an hour (and the
 * browser allows motion), and notes that it played. On /meet a script in
 * the server's page does this before the first paint, and a force reload
 * plays it again; this page draws in the browser, so it asks as it first
 * draws, and a force reload can't be told from a plain one.
 */
export function takeIntro(): boolean {
  try {
    const last = Number(localStorage.getItem(INTRO_KEY)) || 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still && Date.now() - last > INTRO_EVERY_MS) {
      localStorage.setItem(INTRO_KEY, String(Date.now()));
      return true;
    }
  } catch {
    // No storage, as in a locked-down frame: the short entrance.
  }
  return false;
}
