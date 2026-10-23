import Link from "next/link";

/** The TMDB credit their API terms ask for, plus the legal links. */
export default function SiteFooter() {
  return (
    <footer className="sitefoot">
      <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      <span className="dot" aria-hidden>·</span>
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
      <Link href="/model">Smart picks</Link>
    </footer>
  );
}
