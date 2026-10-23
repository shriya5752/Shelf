const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch() for TMDB with a timeout and a couple of tries, so one slow or dropped request
 * (or a rate-limit blip) doesn't turn into an error for the person using the site.
 */
export async function tmdbFetch(url: string, tries = 4): Promise<Response> {
  let last: unknown = new Error("TMDB unreachable");
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`TMDB ${res.status}`);
        await sleep(350 * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      last = e;
      await sleep(250 * (i + 1));
    }
  }
  throw last;
}
