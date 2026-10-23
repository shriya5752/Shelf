import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Privacy — Shelf" };

export default function Privacy() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <div className="doc">
      <main className="doc-in">
        <Link className="brand" href="/">shelf<i>.</i></Link>
        <h1>Privacy</h1>
        <p className="lede-doc">Shelf is a small personal project. Here is exactly what it keeps, in plain words.</p>

        <h2>What I store</h2>
        <ul>
          <li><b>Your account:</b> your email address, a password (stored only as a one-way hash by Supabase, never readable by me) and the username you choose.</li>
          <li><b>Your shelf:</b> the titles you add, with your ratings, notes, dates and anything you write about them.</li>
        </ul>

        <h2>Who can see it</h2>
        <ul>
          <li>Your shelf is <b>public</b> at <code>/u/your-username</code>, so anyone with the link can view it. Don’t put anything private in your notes.</li>
          <li>Your email address is never shown to other people.</li>
          <li>You can switch your public page off in Settings.</li>
        </ul>

        <h2>Services involved</h2>
        <ul>
          <li><b>Supabase</b> stores accounts and shelves.</li>
          <li><b>TMDB</b> supplies posters and movie details. Your searches are sent to TMDB through the Shelf server; your identity is not.</li>
          <li><b>Vercel</b> hosts the site.</li>
          <li>Smart picks is computed on the Shelf server from a file of numbers; your shelf is not sent anywhere else for it.</li>
        </ul>

        <h2>No tracking</h2>
        <p>There are no ads and no analytics cookies. Your browser stores a few small preferences (such as your last view) and the sign-in session.</p>

        <h2>Deleting your data</h2>
        <p>You can remove any title yourself. To delete your whole account and shelf{contact ? <>, email <a href={`mailto:${contact}`}>{contact}</a></> : ", contact the site owner"}.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
