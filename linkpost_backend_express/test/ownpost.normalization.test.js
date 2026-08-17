/**
 * Tests de la normalisation des posts Bright Data (services/ownpost.service.js).
 * C'est cette logique qui décide de l'id retenu pour un post — donc de son
 * dédoublonnage lors d'une synchronisation répétée (upsertManyOwnPosts
 * utilise cet id comme clé d'unicité).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveId, extractMetrics, buildTitle, normalizeOwnPost } from "../services/ownpost.service.js";

test("resolveId : utilise le champ id en priorité", () => {
  assert.equal(resolveId({ id: "123", url: "https://x" }), "123");
});

test("resolveId : retombe sur les variantes usuelles de Bright Data", () => {
  assert.equal(resolveId({ post_id: "abc" }), "abc");
  assert.equal(resolveId({ urn: "urn:li:activity:1" }), "urn:li:activity:1");
  assert.equal(resolveId({ share_id: "9" }), "9");
});

test("resolveId : en dernier recours, retombe sur l'URL (toujours unique)", () => {
  assert.equal(resolveId({ url: "https://linkedin.com/posts/abc" }), "https://linkedin.com/posts/abc");
});

test("resolveId : null si aucun identifiant exploitable — évite un id 'undefined' partagé par plusieurs posts", () => {
  assert.equal(resolveId({}), null);
  assert.equal(resolveId({ id: "" }), null);
});

test("extractMetrics : agrège les variantes de champs Bright Data", () => {
  const m = extractMetrics({ reactions_count: 10, comments_count: 2, shares_count: 1 });
  assert.deepEqual(m, { reactions: 10, comments: 2, shares: 1, total_interactions: 13 });
});

test("extractMetrics : 0 partout si aucune métrique n'est présente", () => {
  assert.deepEqual(extractMetrics({}), { reactions: 0, comments: 0, shares: 0, total_interactions: 0 });
});

test("extractMetrics : ignore les valeurs non numériques plutôt que de planter", () => {
  const m = extractMetrics({ reactions_count: "beaucoup" });
  assert.equal(m.reactions, 0);
});

test("buildTitle : tronque un texte long à 90 caractères avec une ellipse", () => {
  const title = buildTitle({ post_text: "a".repeat(200) });
  assert.equal(title.length, 91); // 90 + "…"
  assert.ok(title.endsWith("…"));
});

test("buildTitle : normalise les espaces/retours à la ligne", () => {
  assert.equal(buildTitle({ post_text: "Bonjour\n\n   le monde" }), "Bonjour le monde");
});

test("buildTitle : valeur de repli si aucun texte n'est disponible", () => {
  assert.equal(buildTitle({}), "Publication sans titre");
});

test("normalizeOwnPost : combine id résolu, titre et métriques sans perdre les champs bruts", () => {
  const raw = { url: "https://x/1", post_text: "Salut", reactions_count: 5, headline: "H" };
  const normalized = normalizeOwnPost(raw);
  assert.equal(normalized.id, "https://x/1");
  assert.equal(normalized.reactions, 5);
  assert.equal(normalized.post_text, "Salut"); // champ brut conservé
});
