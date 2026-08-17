import Image from "next/image";
import Link from "next/link";

/**
 * Palette de marque — dérivée du logo PostGenius AI (tête IA violette
 * sur fond noir-violet, accents bleu/corail). Utilisée telle quelle par
 * toutes les pages qui définissent encore leur propre objet `C` local
 * (mêmes valeurs, dupliquées par fichier — voir chaque page).
 */
export const C = {
  bgMain: "#0d0a1a",
  bgSecondary: "#16112b",
  card: "#1c1533",
  border: "#2f2650",
  textMain: "#f8fafc",
  textSecondary: "#a79bc4",
  blue: "#2563eb",
  cyan: "#38bdf8",
  violet: "#8b5cf6",
  mauve: "#a855f7",
  coral: "#fb8a6b",
  green: "#22c55e",
  amber: "#fbbf24",
  red: "#fca5a5",
};

export const GRAD = "linear-gradient(135deg, #2563eb, #8b5cf6)";
export const GRAD_BLUE_MAUVE = "linear-gradient(135deg, #2563eb, #a855f7)";
export const GRAD_CYAN_MAUVE = "linear-gradient(120deg, #38bdf8, #a855f7)";

/**
 * Logo PostGenius AI — icône (tête IA extraite du logo) + nom du site,
 * toujours cliquable vers l'accueil. À utiliser sur tous les templates.
 */
export function Logo({
  size = 38,
  textSize = 16,
  showText = true,
}: {
  size?: number;
  textSize?: number;
  showText?: boolean;
}) {
  return (
    <Link
      href="/"
      style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}
    >
      <span
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: size * 0.28,
          overflow: "hidden",
          display: "block",
          boxShadow: "0 0 20px -6px rgba(139,92,246,.6)",
        }}
      >
        <Image
          src="/logo-icon.png"
          alt="PostGenius AI"
          width={size}
          height={size}
          priority
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
      {showText && (
        <span style={{ fontWeight: 800, fontSize: textSize, color: C.textMain, letterSpacing: -0.2 }}>
          PostGenius <span style={{ color: C.violet }}>AI</span>
        </span>
      )}
    </Link>
  );
}
