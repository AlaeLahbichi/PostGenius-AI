"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const SITE_NAME = "PostGenius AI";
const CONTACT_EMAIL = "a.lahbichi2004@gmail.com";

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Fonctionnalités", href: "/#features" },
  { label: "Le fonctionnement", href: "/#comment-ca-marche" },
];

/* ------------------------------------------------------------------ */
/*  Icons (inline, no extra deps)                                      */
/* ------------------------------------------------------------------ */
function LogoMark() {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-[0_0_24px_-6px_rgba(37,99,235,0.6)]"
      style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
    >
      P
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Navbar                                                              */
/* ------------------------------------------------------------------ */
function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#1f2937] bg-[#050814]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight text-[#f8fafc]">
            {SITE_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[#94a3b8] transition-colors hover:text-[#f8fafc]"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/contact"
            className="text-sm font-medium text-[#38bdf8]"
          >
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* Ceci est un commentaire JSX<Link
            href="/login"
            className="hidden text-sm text-[#94a3b8] transition-colors hover:text-[#f8fafc] sm:block"
          >
            Se connecter
          </Link>*/}
          <Link
            href="/signup"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(124,58,237,0.6)] transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
          >
            Essayer
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Contact form                                                        */
/* ------------------------------------------------------------------ */
type Status = "idle" | "loading" | "success" | "error";

function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      // Replace this with a real API route (e.g. /api/contact) that emails
      // CONTACT_EMAIL. Falls back to a mailto link if the request fails.
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#1f2937] bg-[#111827] px-8 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-[#22c55e]"
          style={{ background: "rgba(34,197,94,0.12)" }}
        >
          <CheckIcon />
        </div>
        <h3 className="text-lg font-semibold text-[#f8fafc]">Message envoyé</h3>
        <p className="max-w-sm text-sm text-[#94a3b8]">
          Merci de nous avoir écrit. On vous répond généralement sous 24 à 48h à l&apos;adresse indiquée.
        </p>
        <button
          onClick={() => {
            setForm({ name: "", email: "", subject: "", message: "" });
            setStatus("idle");
          }}
          className="mt-2 text-sm font-medium text-[#38bdf8] hover:underline"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-[#1f2937] bg-[#111827] p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-xs font-medium text-[#94a3b8]">
            Nom
          </label>
          <input
            id="name"
            required
            value={form.name}
            onChange={update("name")}
            placeholder="Votre nom"
            className="rounded-lg border border-[#1f2937] bg-[#0b1020] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-[#475569] outline-none transition-colors focus:border-[#2563eb]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-xs font-medium text-[#94a3b8]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            placeholder="vous@exemple.com"
            className="rounded-lg border border-[#1f2937] bg-[#0b1020] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-[#475569] outline-none transition-colors focus:border-[#2563eb]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className="text-xs font-medium text-[#94a3b8]">
          Sujet
        </label>
        <input
          id="subject"
          required
          value={form.subject}
          onChange={update("subject")}
          placeholder="Question, partenariat, bug…"
          className="rounded-lg border border-[#1f2937] bg-[#0b1020] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-[#475569] outline-none transition-colors focus:border-[#2563eb]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-xs font-medium text-[#94a3b8]">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={form.message}
          onChange={update("message")}
          placeholder="Décrivez votre demande en quelques lignes…"
          className="resize-none rounded-lg border border-[#1f2937] bg-[#0b1020] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-[#475569] outline-none transition-colors focus:border-[#2563eb]"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-[#fca5a5]">
          Une erreur est survenue lors de l&apos;envoi. Réessayez, ou écrivez-nous
          directement à{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(37,99,235,0.6)] transition-transform hover:scale-[1.01] disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
      >
        {status === "loading" ? "Envoi en cours…" : "Envoyer le message"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Info card                                                           */
/* ------------------------------------------------------------------ */
function InfoCard() {
  const items = [
    {
      icon: <MailIcon />,
      title: "Par email",
      desc: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}`,
    },
    {
      icon: <ClockIcon />,
      title: "Temps de réponse",
      desc: "Sous 24 à 48h, jours ouvrés",
    },
    {
      icon: <SparkIcon />,
      title: "Ce que vous pouvez demander",
      desc: "Support produit, partenariats, presse, ou toute idée pour améliorer vos posts LinkedIn.",
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#1f2937] bg-[#111827] p-6 sm:p-8">
      <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#1f2937] bg-[#0b1020] px-3 py-1 text-xs font-medium text-[#38bdf8]">
        Contact
      </div>
      <h2 className="text-xl font-semibold text-[#f8fafc]">
        On vous écoute
      </h2>
      <p className="text-sm leading-relaxed text-[#94a3b8]">
        Une question sur la génération de posts, un bug, une idée de fonctionnalité ?
        Écrivez-nous, une vraie personne vous répond.
      </p>

      <div className="mt-2 flex flex-col gap-4">
        {items.map((item) => {
          const content = (
            <div className="flex items-start gap-3 rounded-xl border border-[#1f2937] bg-[#0b1020] p-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: "linear-gradient(135deg, #2563eb, #a855f7)" }}
              >
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-[#f8fafc]">{item.title}</p>
                <p className="mt-0.5 text-sm text-[#94a3b8]">{item.desc}</p>
              </div>
            </div>
          );
          return item.href ? (
            <a key={item.title} href={item.href} className="transition-opacity hover:opacity-90">
              {content}
            </a>
          ) : (
            <div key={item.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#050814]">
      <Navbar />

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        {/* ambient glow, consistent with hero/orb treatment on the rest of the site */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-25 blur-[110px]"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
        />

        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f2937] bg-[#111827] px-3 py-1 text-xs font-medium text-[#38bdf8]">
            Contact
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl">
            Parlons de vos posts{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, #38bdf8, #a855f7)" }}
            >
              qui marchent
            </span>
          </h1>
          <p className="mt-4 text-base text-[#94a3b8]">
            Une question, un bug ou une idée pour {SITE_NAME} ? Notre équipe vous répond rapidement.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ContactForm />
          </div>
          <div className="lg:col-span-2">
            <InfoCard />
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1f2937] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="text-sm text-[#94a3b8]">
              © {new Date().getFullYear()} {SITE_NAME}. Tous droits réservés.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <Link href="/" className="hover:text-[#f8fafc]">Accueil</Link>
            <Link href="/#faq" className="hover:text-[#f8fafc]">FAQ</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#f8fafc]">{CONTACT_EMAIL}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}