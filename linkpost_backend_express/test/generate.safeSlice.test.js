/**
 * Régression : un post réel (mes_postes/concurrent) tronqué pour servir
 * d'exemple à la génération IA (generate.service.js) ne doit jamais couper
 * au milieu d'un emoji — ça produit un substitut UTF-16 isolé, invalide en
 * UTF-8, que l'API OpenRouter/le fournisseur du modèle rejette
 * (400 "Provider returned error").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeSlice } from "../services/generate.service.js";

test("safeSlice : ne coupe pas au milieu d'une paire de substituts (emoji)", () => {
  // "Bravo " (6) + 🎉 (2 unités UTF-16) : couper à 7 tomberait pile au
  // milieu de l'emoji.
  const text = "Bravo 🎉 à toute l'équipe !";
  const cut = safeSlice(text, 7);
  // Ne doit contenir aucun substitut isolé.
  for (const ch of cut) {
    const code = ch.charCodeAt(0);
    assert.ok(!(code >= 0xd800 && code <= 0xdbff) || cut.length > 1);
  }
  assert.doesNotThrow(() => JSON.stringify(cut));
  // Le résultat doit rester un JSON valide une fois ré-encodé (pas de
  // caractère de remplacement U+FFFD introduit par un substitut isolé).
  assert.equal(JSON.parse(JSON.stringify(cut)), cut);
});

test("safeSlice : ne touche pas un texte plus court que la limite", () => {
  assert.equal(safeSlice("court", 100), "court");
});

test("safeSlice : tronque normalement un texte sans emoji au point de coupe", () => {
  assert.equal(safeSlice("abcdefghij", 5), "abcde");
});
