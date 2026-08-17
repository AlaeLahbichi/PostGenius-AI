"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "../theme";

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */

const SITE_NAME = "PostGenius AI";
// mes_postes (postes LinkedIn personnels synchronisés), exposée par /ownposts —
// pas /linkedin/posts, qui lit l'ancienne collection "publications" (inutilisée).
const API_URL = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/ownposts";

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Fonctionnalités", href: "/#features" },
  { label: "Le fonctionnement", href: "/#comment-ca-marche" },
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Plus récents" },
  { value: "date_asc", label: "Plus anciens" },
  { value: "likes_desc", label: "Plus de likes" },
  { value: "comments_desc", label: "Plus de commentaires" },
  { value: "interactions_desc", label: "Plus d'interactions" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface LinkedInPost {
  id: string;
  url: string;
  headline?: string | null;
  post_text: string;
  post_type?: string;
  date_posted: string;
  hashtags?: string[] | null;
  images?: string[] | null;
  videos?: string[] | null;
  video_thumbnail?: string | null;
  reactions: number;
  comments: number;
  shares?: number;
  total_interactions?: number;
  user_name?: string;
  user_profile_pic?: string;
  user_followers?: number;
}

interface PostsResponse {
  success: boolean;
  total: number;
  posts: LinkedInPost[];
}

type MediaItem =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

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

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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

function RepeatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
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
            href="/load_posts"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(124,58,237,0.6)] transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
          >
            Post Import
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Media carousel (images + videos)                                    */
/* ------------------------------------------------------------------ */
function MediaCarousel({ media, alt }: { media: MediaItem[]; alt: string }) {
  const [index, setIndex] = useState(0);

  if (!media || media.length === 0) return null;

  const current = media[index];

  function prev(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i === 0 ? media.length - 1 : i - 1));
  }

  function next(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i === media.length - 1 ? 0 : i + 1));
  }

  return (
    <div className="group relative h-48 w-full overflow-hidden bg-[#16112b]">
      {current.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <video
          key={current.src}
          src={current.src}
          poster={current.poster}
          controls
          className="h-full w-full object-cover"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {current.type === "video" && (
        <span
          className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <PlayIcon /> Vidéo
        </span>
      )}

      {media.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Média précédent"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={next}
            aria-label="Média suivant"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <ChevronRightIcon />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {media.map((m, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  background: i === index ? "#38bdf8" : "rgba(248,250,252,0.4)",
                  width: i === index ? "14px" : "6px",
                }}
              />
            ))}
          </div>
          <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {index + 1}/{media.length}
          </span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Post card                                                           */
/* ------------------------------------------------------------------ */
function PostCard({ post }: { post: LinkedInPost }) {
  const router = useRouter();
  const interactions = post.total_interactions ?? post.reactions + post.comments;
  const formattedDate = new Date(post.date_posted).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const media: MediaItem[] = useMemo(() => {
    const videoItems: MediaItem[] = (post.videos ?? []).map((src) => ({
      type: "video",
      src,
      poster: post.video_thumbnail ?? undefined,
    }));
    const imageItems: MediaItem[] = (post.images ?? []).map((src) => ({
      type: "image",
      src,
    }));
    // Videos first, since they're the richer / rarer media.
    return [...videoItems, ...imageItems];
  }, [post.images, post.videos, post.video_thumbnail]);

  function handleConsulter() {
    router.push(`/post?id=${encodeURIComponent(post.id)}&source=own`);
  }

  function handleAnalyser() {
    console.log("Analyser le post :", post.id);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#2f2650] bg-[#1c1533] transition-transform hover:-translate-y-0.5">
      <MediaCarousel media={media} alt={post.headline ?? "Post LinkedIn"} />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {post.user_profile_pic && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.user_profile_pic}
                alt={post.user_name ?? ""}
                className="h-6 w-6 rounded-full object-cover"
              />
            )}
            <span className="text-xs font-medium text-[#f8fafc]">{post.user_name}</span>
            {post.post_type === "repost" && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "rgba(148,163,184,0.15)", color: "#a79bc4" }}
              >
                <RepeatIcon /> Repost
              </span>
            )}
          </div>
          <span className="text-xs text-[#a79bc4]">{formattedDate}</span>
        </div>

        {post.headline && (
          <h3 className="line-clamp-2 text-sm font-semibold text-[#f8fafc]">{post.headline}</h3>
        )}

        <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-[#a79bc4]">
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
              <HeartIcon /> {post.reactions}
            </span>
            <span className="flex items-center gap-1.5">
              <CommentIcon /> {post.comments}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}
            >
              {interactions} interactions
            </span>
          </div>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-[#38bdf8] transition-opacity hover:opacity-80"
          >
            LinkedIn <ExternalLinkIcon />
          </a>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConsulter}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#2f2650] bg-[#16112b] py-2 text-xs font-medium text-[#f8fafc] transition-colors hover:border-[#2563eb]"
          >
            <EyeIcon /> Consulter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toolbar                                                             */
/* ------------------------------------------------------------------ */
function Toolbar({
  sort,
  onSortChange,
  total,
}: {
  sort: SortValue;
  onSortChange: (v: SortValue) => void;
  total: number;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-[#a79bc4]">
        <span className="font-semibold text-[#f8fafc]">{total}</span> post{total > 1 ? "s" : ""} au total
      </p>
      <div className="flex items-center gap-2">
        <label htmlFor="sort" className="text-xs text-[#a79bc4]">
          Trier par
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortValue)}
          className="rounded-lg border border-[#2f2650] bg-[#1c1533] px-3 py-2 text-xs font-medium text-[#f8fafc] outline-none transition-colors focus:border-[#2563eb]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1c1533]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  States                                                              */
/* ------------------------------------------------------------------ */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#a79bc4]">
      <SpinnerIcon />
      <p className="text-sm">Chargement des posts…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#2f2650] bg-[#1c1533] px-8 py-16 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "rgba(252,165,165,0.12)", color: "#fca5a5" }}
      >
        <AlertIcon />
      </div>
      <h3 className="text-base font-semibold text-[#f8fafc]">Impossible de charger les posts</h3>
      <p className="max-w-sm text-sm text-[#a79bc4]">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function LinkedInPostsListPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>("date_desc");

  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`Le serveur a répondu avec le statut ${res.status}`);
        const data: PostsResponse = await res.json();
        if (!data.success) throw new Error("La récupération des posts a échoué.");
        if (!cancelled) setPosts(data.posts);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `${err.message}. Vérifiez que l'API tourne bien sur ${API_URL}.`
              : "Une erreur inconnue est survenue."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedPosts = useMemo(() => {
    const copy = [...posts];
    switch (sort) {
      case "date_asc":
        return copy.sort((a, b) => new Date(a.date_posted).getTime() - new Date(b.date_posted).getTime());
      case "likes_desc":
        return copy.sort((a, b) => b.reactions - a.reactions);
      case "comments_desc":
        return copy.sort((a, b) => b.comments - a.comments);
      case "interactions_desc":
        return copy.sort(
          (a, b) =>
            (b.total_interactions ?? b.reactions + b.comments) -
            (a.total_interactions ?? a.reactions + a.comments)
        );
      case "date_desc":
      default:
        return copy.sort((a, b) => new Date(b.date_posted).getTime() - new Date(a.date_posted).getTime());
    }
  }, [posts, sort]);

  return (
    <div className="min-h-screen bg-[#0d0a1a]">
      <Navbar />

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-25 blur-[110px]"
          style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
        />

        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2f2650] bg-[#1c1533] px-3 py-1 text-xs font-medium text-[#38bdf8]">
            Mes posts
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl">
            Tous les posts{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, #38bdf8, #a855f7)" }}
            >
              qui marchent
            </span>
          </h1>
          <p className="mt-4 text-base text-[#a79bc4]">
            Parcourez, triez et analysez les posts LinkedIn récupérés par {SITE_NAME}.
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-6">
          {!loading && !error && <Toolbar sort={sort} onSortChange={setSort} total={sortedPosts.length} />}

          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} />}

          {!loading && !error && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}