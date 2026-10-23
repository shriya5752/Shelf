import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Terms — Shelf" };

export default function Terms() {
  return (
    <div className="doc">
      <main className="doc-in">
        <Link className="brand" href="/">shelf<i>.</i></Link>
        <h1>Terms</h1>
        <p className="lede-doc">Shelf is a free hobby project, provided as it is. Short and simple:</p>
        <ul>
          <li>Be kind. Don’t post anything unlawful, hateful or that targets other people in your notes or username. I may remove accounts that do.</li>
          <li>Your shelf page is public. You are responsible for what you write on it.</li>
          <li>The service comes with no guarantees. It may change, pause or disappear, and your data could be lost.</li>
          <li>Movie and series information and posters belong to their owners and come from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</li>
          <li>Smart picks is an experiment trained on MovieLens data (GroupLens, University of Minnesota) and is not a promise of what you will enjoy.</li>
        </ul>
        <p>See also the <Link href="/privacy">privacy page</Link>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
