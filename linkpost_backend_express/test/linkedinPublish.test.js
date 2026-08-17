/**
 * Tests de la construction du texte envoyé à l'API LinkedIn
 * (services/linkedinPublish.service.js). LinkedIn n'a pas de champ
 * hashtags dédié : une erreur ici publie un texte cassé, pour de vrai.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareText } from "../services/linkedinPublish.service.js";

test("buildShareText : texte seul si aucun hashtag", () => {
  assert.equal(buildShareText("Bonjour LinkedIn", []), "Bonjour LinkedIn");
  assert.equal(buildShareText("Bonjour LinkedIn", undefined), "Bonjour LinkedIn");
});

test("buildShareText : ajoute les hashtags après deux sauts de ligne", () => {
  const text = buildShareText("Mon post", ["#ia", "#linkedin"]);
  assert.equal(text, "Mon post\n\n#ia #linkedin");
});

test("buildShareText : ajoute le # si absent", () => {
  const text = buildShareText("Mon post", ["ia"]);
  assert.equal(text, "Mon post\n\n#ia");
});

test("buildShareText : ignore les hashtags vides", () => {
  const text = buildShareText("Mon post", ["", "#ia", null]);
  assert.equal(text, "Mon post\n\n#ia");
});

test("buildShareText : retire les espaces superflus du texte", () => {
  assert.equal(buildShareText("  Mon post  ", []), "Mon post");
});
