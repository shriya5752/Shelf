import type { Draft, Entry } from "./types";
import { supabase } from "./supabase";

type Row = {
  id: string; source: "tmdb" | "demo"; external_id: number; media_type: "movie" | "tv"; title: string;
  year: number | null; creator: string | null; genres: string[] | null; poster_url: string | null;
  color: string; ink: string; seasons: number | null; status: "watched" | "want" | null; rating: number | null; watched_on: string | null;
  liked: string | null; learned: string | null; created_at: string;
};

const fromRow = (r: Row): Entry => ({
  id: r.id, source: r.source, externalId: Number(r.external_id), mediaType: r.media_type, title: r.title,
  year: r.year, creator: r.creator ?? "", genres: r.genres ?? [], posterUrl: r.poster_url, color: r.color, ink: r.ink,
  seasons: r.seasons, status: r.status ?? "watched", rating: r.rating ?? 0, watchedOn: r.watched_on ?? "", liked: r.liked ?? "",
  learned: r.learned ?? "", createdAt: r.created_at,
});

const toRow = (d: Draft, userId: string) => ({
  user_id: userId, source: d.source, external_id: d.externalId, media_type: d.mediaType, title: d.title,
  year: d.year, creator: d.creator, genres: d.genres, poster_url: d.posterUrl, color: d.color, ink: d.ink,
  seasons: d.seasons, status: d.status, rating: d.rating, watched_on: d.watchedOn || null, liked: d.liked, learned: d.learned,
});

function client() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export type Profile = { id: string; username: string; displayName: string | null; isPublic: boolean };

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data } = await client().from("profiles").select("id, username, display_name, is_public").eq("id", userId).maybeSingle();
  return data ? { id: data.id, username: data.username, displayName: data.display_name, isPublic: data.is_public } : null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data } = await client().from("profiles").select("id, username, display_name, is_public").eq("username", username.toLowerCase()).maybeSingle();
  return data ? { id: data.id, username: data.username, displayName: data.display_name, isPublic: data.is_public } : null;
}

export async function listEntries(userId: string): Promise<Entry[]> {
  const { data, error } = await client().from("entries").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(2000);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function insertEntry(userId: string, d: Draft): Promise<Entry> {
  const { data, error } = await client().from("entries").insert(toRow(d, userId)).select("*").single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function updateEntry(userId: string, id: string, d: Draft): Promise<Entry> {
  const { data, error } = await client().from("entries").update(toRow(d, userId)).eq("id", id).eq("user_id", userId).select("*").single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  const { error } = await client().from("entries").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function setProfilePublic(userId: string, isPublic: boolean): Promise<void> {
  const { error } = await client().from("profiles").update({ is_public: isPublic }).eq("id", userId);
  if (error) throw error;
}

export async function updateProfile(userId: string, patch: { username?: string; displayName?: string | null; isPublic?: boolean }): Promise<Profile> {
  const row: Record<string, unknown> = {};
  if (patch.username !== undefined) row.username = patch.username.toLowerCase();
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.isPublic !== undefined) row.is_public = patch.isPublic;
  const { data, error } = await client().from("profiles").update(row).eq("id", userId).select("id, username, display_name, is_public").single();
  if (error) throw error;
  return { id: data.id, username: data.username, displayName: data.display_name, isPublic: data.is_public };
}
