import Link from "next/link";
import { Logo } from "./theme";

const SITE_NAME = "PostGenius AI";

/* ------------------------------------------------------------------ */
/*  Icons (inline, no extra deps — same convention as the other pages) */
/* ------------------------------------------------------------------ */
function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5" />
      <circle cx="18" cy="8.5" r="2.4" />
      <path d="M16.5 14.7c2.5.4 4.3 2.3 4.9 5.3" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l4-4" />
      <path d="M12 7v.01M17 12h.01M7 12h.01" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                          */
/* ------------------------------------------------------------------ */
const LINKS = [
  {
    href: "/dashboard",
    icon: <DashboardIcon />,
    title: "Tableau de bord",
    desc: "Statistiques globales et évolution de vos posts LinkedIn, avec synchronisation automatique.",
  },
  {
    href: "/create",
    icon: <SparkIcon />,
    title: "Générer un post",
    desc: "Créez un nouveau post LinkedIn assisté par IA à partir de vos dimensions préférées.",
  },
  {
    href: "/posts",
    icon: <ListIcon />,
    title: "Mes posts",
    desc: "Parcourez, triez et analysez l'ensemble des posts LinkedIn récupérés.",
  },
  {
    href: "/load_posts",
    icon: <DownloadIcon />,
    title: "Importer depuis LinkedIn",
    desc: "Entrez l'URL d'un profil LinkedIn pour en récupérer et analyser les posts.",
  },
  {
    href: "/concurrent",
    icon: <UsersIcon />,
    title: "Concurrents",
    desc: "Suivez et analysez les posts publiés par vos concurrents.",
  },
  {
    href: "/keys",
    icon: <GaugeIcon />,
    title: "Caractéristiques",
    desc: "Évaluez l'impact des structures, styles, angles, tons et formats sur vos performances.",
  },
  {
    href: "/contact",
    icon: <MailIcon />,
    title: "Contact",
    desc: "Une question, un bug, une idée ? Écrivez-nous directement.",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <div className="min-h-screen bg-[#0d0a1a]">
      <header className="sticky top-0 z-50 border-b border-[#2f2650] bg-[#0d0a1a]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo size={36} textSize={15} />
          <Link
            href="/create"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(124,58,237,0.6)] transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
          >
            Générer un post
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-25 blur-[110px]"
          style={{ background: "linear-gradient(135deg, #2563eb, #8b5cf6)" }}
        />

        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2f2650] bg-[#1c1533] px-3 py-1 text-xs font-medium text-[#38bdf8]">
            Accueil
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl">
            Vos posts LinkedIn{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, #38bdf8, #a855f7)" }}
            >
              qui marchent
            </span>
          </h1>
          <p className="mt-4 text-base text-[#a79bc4]">
            Retrouvez ici tous les espaces de {SITE_NAME} : génération, suivi, import et analyse concurrentielle.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col gap-4 rounded-2xl border border-[#2f2650] bg-[#1c1533] p-6 transition-colors hover:border-[#2563eb]"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ background: "linear-gradient(135deg, #2563eb, #a855f7)" }}
              >
                {link.icon}
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#f8fafc]">{link.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#a79bc4]">{link.desc}</p>
              </div>
              <span className="mt-auto text-sm font-medium text-[#38bdf8] transition-transform group-hover:translate-x-1">
                Ouvrir →
              </span>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-[#2f2650] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={28} showText={false} />
            <span className="text-sm text-[#a79bc4]">
              © {new Date().getFullYear()} {SITE_NAME}. Tous droits réservés.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#a79bc4]">
            <Link href="/contact" className="hover:text-[#f8fafc]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
