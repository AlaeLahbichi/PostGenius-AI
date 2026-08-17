"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Logo } from "../theme";

const SITE_NAME = "PostGenius AI";
const API_URL = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/linkedin/posts/filter";

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Fonctionnalités", href: "/#features" },
  { label: "Le fonctionnement", href: "/#comment-ca-marche" },
];

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface LinkedInPost {
  id: string;
  url: string;
  headline?: string | null;
  post_text: string;
  date_posted: string;
  hashtags?: string[] | null;
  images?: string[] | null;
  num_likes: number;
  num_comments: number;
  total_interactions?: number;
  user_name?: string;
  user_profile_pic?: string;
}

interface FilterResponse {
  success: boolean;
  totalFetched: number;
  totalReturned: number;
  database?: {
    totalProcessed: number;
    inserted: number;
    updated: number;
  };
  posts: LinkedInPost[];
}

type ToastState = { type: "success" | "error"; message: string } | null;

/* ------------------------------------------------------------------ */
/*  Icons                                                               */
/* ------------------------------------------------------------------ */
function HeartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.8 4.6c-1.9-1.9-5-1.9-6.9 0L12 5.5l-1.9-1.9c-1.9-1.9-5-1.9-6.9 0-1.9 1.9-1.9 5 0 6.9L12 19l8.8-8.5c1.9-1.9 1.9-5 0-6.9z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Navbar                                                              */
/* ------------------------------------------------------------------ */
function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#2f2650] bg-[#0d0a1a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo size={36} textSize={15} />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[#a79bc4] transition-colors hover:text-[#f8fafc]"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/posts" className="text-sm font-medium text-[#38bdf8]">
            Mes posts
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(124,58,237,0.6)] transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
          >
            Essayer
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast                                                               */
/* ------------------------------------------------------------------ */
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const isSuccess = toast.type === "success";

  return (
    <div className="fixed right-6 top-20 z-[60] w-[calc(100%-3rem)] max-w-sm animate-[fadeIn_0.2s_ease-out]">
      <div
        className="flex items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md"
        style={{
          background: "#1c1533",
          borderColor: isSuccess ? "rgba(34,197,94,0.35)" : "rgba(252,165,165,0.35)",
        }}
      >
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isSuccess ? "rgba(34,197,94,0.15)" : "rgba(252,165,165,0.15)",
            color: isSuccess ? "#22c55e" : "#fca5a5",
          }}
        >
          {isSuccess ? <CheckIcon /> : <AlertIcon />}
        </div>
        <p className="flex-1 text-sm leading-relaxed text-[#f8fafc]">{toast.message}</p>
        <button
          onClick={onClose}
          className="text-[#a79bc4] transition-colors hover:text-[#f8fafc]"
          aria-label="Fermer la notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter form                                                        */
/* ------------------------------------------------------------------ */
function FilterForm({
  onResult,
  onError,
  loading,
  setLoading,
}: {
  onResult: (data: FilterResponse) => void;
  onError: (msg: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const [profileUrl, setProfileUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profileUrl.trim()) {
      onError("L'URL du profil LinkedIn est obligatoire.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string | number> = { profileUrl: profileUrl.trim() };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (count) body.count = Number(count);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Le serveur a répondu avec le statut ${res.status}`);

      const data: FilterResponse = await res.json();
      if (!data.success) throw new Error("La récupération des posts a échoué.");

      onResult(data);
    } catch (err) {
      onError(
        err instanceof Error
          ? `Impossible de charger les posts : ${err.message}`
          : "Impossible de charger les posts."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-[#2f2650] bg-[#1c1533] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="profileUrl" className="text-xs font-medium text-[#a79bc4]">
          URL du profil LinkedIn <span className="text-[#fca5a5]">*</span>
        </label>
        <input
          id="profileUrl"
          required
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/votre-profil/"
          className="rounded-lg border border-[#2f2650] bg-[#16112b] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-[#5b5178] outline-none transition-colors focus:border-[#2563eb]"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="startDate" className="text-xs font-medium text-[#a79bc4]">
            Date de début
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-[#2f2650] bg-[#16112b] px-3.5 py-2.5 text-sm text-[#f8fafc] outline-none transition-colors [color-scheme:dark] focus:border-[#2563eb]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="endDate" className="text-xs font-medium text-[#a79bc4]">
            Date de fin
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-[#2f2650] bg-[#16112b] px-3.5 py-2.5 text-sm text-[#f8fafc] outline-none transition-colors [color-scheme:dark] focus:border-[#2563eb]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="count" className="text-xs font-medium text-[#a79bc4]">
            Nombre de posts
          </label>
          <input
            id="count"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Tous"
            className="rounded-lg border border-[#2f2650] bg-[#16112b] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-[#5b5178] outline-none transition-colors focus:border-[#2563eb]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(37,99,235,0.6)] transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
        style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
      >
        {loading ? (
          <>
            <SpinnerIcon /> Chargement des posts…
          </>
        ) : (
          <>
            <SparkIcon /> Charger les posts
          </>
        )}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats bar                                                           */
/* ------------------------------------------------------------------ */
function StatsBar({ data }: { data: FilterResponse }) {
  const stats = [
    { label: "Posts récupérés", value: data.totalFetched, color: "#2563eb" },
    { label: "Posts retournés", value: data.totalReturned, color: "#38bdf8" },
    { label: "Nouveaux enregistrés", value: data.database?.inserted ?? 0, color: "#a855f7" },
    { label: "Mis à jour", value: data.database?.updated ?? 0, color: "#22c55e" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-[#2f2650] bg-[#1c1533] px-4 py-4 text-center"
        >
          <p className="text-2xl font-bold" style={{ color: s.color }}>
            {s.value}
          </p>
          <p className="mt-1 text-xs text-[#a79bc4]">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Post card                                                           */
/* ------------------------------------------------------------------ */
function PostCard({ post }: { post: LinkedInPost }) {
  const image = post.images && post.images.length > 0 ? post.images[0] : null;
  const formattedDate = new Date(post.date_posted).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#2f2650] bg-[#1c1533] transition-transform hover:-translate-y-0.5">
      {image && (
        <div className="h-44 w-full overflow-hidden bg-[#16112b]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a79bc4]">{formattedDate}</span>
          {post.total_interactions !== undefined && (
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}
            >
              {post.total_interactions} interactions
            </span>
          )}
        </div>

        {post.headline && (
          <h3 className="line-clamp-2 text-sm font-semibold text-[#f8fafc]">{post.headline}</h3>
        )}

        <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-[#a79bc4]">
          {post.post_text}
        </p>

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-[#2f2650] pt-3">
          <div className="flex items-center gap-4 text-xs text-[#a79bc4]">
            <span className="flex items-center gap-1.5">
              <HeartIcon /> {post.num_likes}
            </span>
            <span className="flex items-center gap-1.5">
              <CommentIcon /> {post.num_comments}
            </span>
          </div>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-[#38bdf8] transition-opacity hover:opacity-80"
          >
            Voir sur LinkedIn <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#2f2650] bg-[#1c1533]/40 px-8 py-16 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "rgba(37,99,235,0.12)", color: "#38bdf8" }}
      >
        <SparkIcon />
      </div>
      <h3 className="text-base font-semibold text-[#f8fafc]">Aucun post chargé pour l&apos;instant</h3>
      <p className="max-w-sm text-sm text-[#a79bc4]">
        Renseignez l&apos;URL d&apos;un profil LinkedIn ci-dessus et lancez la récupération pour voir apparaître les posts ici.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function LinkedInPostsPage() {
  const [result, setResult] = useState<FilterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  function handleResult(data: FilterResponse) {
    setResult(data);
    setToast({
      type: "success",
      message: `${data.totalReturned} post${data.totalReturned > 1 ? "s" : ""} chargé${
        data.totalReturned > 1 ? "s" : ""
      } avec succès${
        data.database ? ` — ${data.database.inserted} nouveau(x), ${data.database.updated} mis à jour` : ""
      }.`,
    });
    window.setTimeout(() => setToast(null), 5000);
  }

  function handleError(msg: string) {
    setToast({ type: "error", message: msg });
    window.setTimeout(() => setToast(null), 6000);
  }

  return (
    <div className="min-h-screen bg-[#0d0a1a]">
      <Navbar />
      <Toast toast={toast} onClose={() => setToast(null)} />

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-25 blur-[110px]"
          style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
        />

        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2f2650] bg-[#1c1533] px-3 py-1 text-xs font-medium text-[#38bdf8]">
            Import LinkedIn
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl">
            Récupérez les posts{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, #38bdf8, #a855f7)" }}
            >
              qui marchent
            </span>
          </h1>
          <p className="mt-4 text-base text-[#a79bc4]">
            Entrez l&apos;URL d&apos;un profil LinkedIn pour analyser ses posts avec {SITE_NAME}.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <FilterForm onResult={handleResult} onError={handleError} loading={loading} setLoading={setLoading} />
        </div>

        <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-8">
          {result && <StatsBar data={result} />}

          {result && result?.posts?.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.posts.map((post,index) => (
                <PostCard key={`${post.id}-${index}`} post={post} />
              ))}
            </div>
          ) : (
            !loading && <EmptyState />
          )}
        </div>
      </main>
    </div>
  );
}