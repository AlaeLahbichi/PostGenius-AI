/**
 * Tests du matching entre un poste généré publié et sa version réellement
 * synchronisée (services/postReconciliation.service.js) — c'est ce qui
 * ferme la boucle entre "j'ai publié ce post avec ces dimensions" et
 * "voici ses vraies performances" dans le scoring de Caractéristiques.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, findMatch } from "../services/postReconciliation.service.js";

test("normalizeText : insensible aux accents, à la casse et aux espaces multiples", () => {
  assert.equal(normalizeText("Écrire  du   contenu"), normalizeText("ecrire du contenu"));
});

test("findMatch : retrouve le poste réel malgré les hashtags ajoutés à la publication", () => {
  const created = { post_text: "Ceci est mon nouveau post sur l'IA générative et son impact." };
  const ownPosts = [
    { id: "post-1", post_text: "Ceci est mon nouveau post sur l'IA générative et son impact.\n\n#IA #Tech" },
  ];
  const match = findMatch(created, ownPosts);
  assert.equal(match?.id, "post-1");
});

test("findMatch : ne matche pas un post totalement différent", () => {
  const created = { post_text: "Un post sur le recrutement tech." };
  const ownPosts = [{ id: "post-2", post_text: "Un tout autre sujet, sans rapport." }];
  assert.equal(findMatch(created, ownPosts), null);
});

test("findMatch : ignore les posts sans id (impossibles à relier dans dim_*)", () => {
  const created = { post_text: "Texte identique pour ce test de correspondance." };
  const ownPosts = [{ post_text: "Texte identique pour ce test de correspondance." }];
  assert.equal(findMatch(created, ownPosts), null);
});

test("findMatch : null si le poste généré n'a pas de texte", () => {
  assert.equal(findMatch({ post_text: "" }, [{ id: "x", post_text: "peu importe" }]), null);
});
