import type { Metadata } from "next";
import Link from "next/link";
import meta from "../../../data/smartpicks/meta.json";

export const metadata: Metadata = {
  title: "How Smart picks works — Shelf",
  description: "A small recommendation model I trained myself, what it does, how I tested it, and where it falls short.",
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default function ModelPage() {
  const t = meta.test;
  return (
    <div className="doc">
      <main className="doc-in">
        <Link className="brand" href="/">shelf<i>.</i></Link>

        <h1>Smart picks: <em>something I tried</em></h1>
        <p className="lede-doc">
          I wanted to learn how recommendation models really work, so I trained a small one myself and plugged it into Shelf.
          It’s an experiment, not magic. Here’s what it does, how I tested it, and where it falls short.
        </p>

        <h2>What it does</h2>
        <ol>
          <li>It learned a short list of numbers for every movie, from which movies people tend to like <em>together</em>. Movies liked by the same kinds of people end up with similar numbers.</li>
          <li>Your taste is built by combining the numbers of the movies on your shelf that you liked.</li>
          <li>It then suggests the movies whose numbers line up best with your taste, and tells you which of your movies led to each one.</li>
        </ol>
        <p>Nothing is trained on <em>you</em>. Your shelf is only used, at that moment, to work out your taste.</p>

        <h2>How I trained and tested it</h2>
        <ul>
          <li><b>Data:</b> {meta.ratings.toLocaleString()} real ratings from {meta.users} people for {meta.count.toLocaleString()} movies (MovieLens, from the GroupLens research group).</li>
          <li><b>Method:</b> a matrix-factorisation technique called PureSVD, giving every movie {meta.dim} numbers. I also tried a neural network (PyTorch); on a dataset this small it did worse.</li>
          <li><b>Test:</b> for each person I hid the last movie they liked, showed the model only what they had rated before it, and checked whether the hidden movie appeared in its top 10 out of about 9,700.</li>
        </ul>

        <div className="stat3">
          <div className="stat"><b>{pct(t["hit@10"])}</b><span>Smart picks found it</span></div>
          <div className="stat"><b>{pct(t["popularity_hit@10"])}</b><span>just recommending popular movies</span></div>
          <div className="stat"><b>{t.lift.toFixed(1)}×</b><span>as many hits as the baseline</span></div>
        </div>
        <p className="note">
          The improvement is between {pct(t.lift_interval_diff[0])} and {pct(t.lift_interval_diff[1])} points (95% interval from a paired bootstrap), so it is not luck, but the absolute numbers are small, as they are for any recommender choosing from thousands of movies.
        </p>

        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/model/04_test_results.png" alt="Bar chart of test results: Smart picks 8.6 percent, a neural network 6.6, popularity 4.2, genres only 0.2" width={760} height={360} />
          <figcaption>Test results on people the model had never seen. Whiskers are 95% intervals.</figcaption>
        </figure>

        <h2>Where it falls short</h2>
        <ul>
          <li><b>Movies up to {meta.latest_movie_year} only.</b> The data has no TV series and nothing newer, so it can’t suggest series or new releases.</li>
          <li><b>It needs history.</b> With only 1 to 5 liked movies it is no better than recommending popular ones, so for small shelves it leans on popularity and hands over gradually as your shelf grows (about {meta.hand_over_n0} movies).</li>
          <li><b>It drifts toward blockbusters.</b> The “Play it safe ↔ Surprise me” slider trades some obviousness for variety; in my tests moving to the middle cost no measurable accuracy.</li>
          <li><b>Small data.</b> {meta.users} people is tiny; a bigger dataset would help a neural model catch up.</li>
        </ul>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/model/05_cold_start.png" alt="Line chart of accuracy against how many movies the model knows about a person" width={760} height={400} />
          <figcaption>How much history it needs: it overtakes the popularity baseline after roughly 10 to 20 rated movies.</figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/model/06_discovery.png" alt="Chart of accuracy and share of blockbuster picks as the discovery setting increases" width={760} height={400} />
          <figcaption>The “Surprise me” setting: fewer blockbusters, similar accuracy up to the middle.</figcaption>
        </figure>

        <h2>The code</h2>
        <p>The full notebook (data exploration, the models I compared, the tests and the mistakes I fixed along the way) and the code are in this project’s <code>ml</code> folder.</p>

        <h2>Credits</h2>
        <p>
          Training data: F. Maxwell Harper and Joseph A. Konstan, <em>The MovieLens Datasets: History and Context</em>, ACM Transactions on Interactive Intelligent Systems 5(4), 2015.
          Provided by GroupLens (University of Minnesota) for non-commercial research and education.
        </p>
        <p>Posters and movie details: this product uses the TMDB API but is not endorsed or certified by TMDB.</p>

        <p style={{ marginTop: 36 }}><Link className="btn" href="/" style={{ textDecoration: "none" }}>Back to Shelf</Link></p>
      </main>
    </div>
  );
}
