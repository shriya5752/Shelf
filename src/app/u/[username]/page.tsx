import { Suspense } from "react";
import PublicShelf from "@/components/PublicShelf";

// `params` is runtime data, so it is read inside a Suspense boundary (Cache Components).
async function Resolved({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PublicShelf username={decodeURIComponent(username)} />;
}

export default function Page({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<div className="boot">shelf.</div>}>
      <Resolved params={params} />
    </Suspense>
  );
}
