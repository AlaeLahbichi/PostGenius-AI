/**
 * Tests du regroupement jour/moment-de-la-journée pour la suggestion du
 * meilleur moment pour publier (services/key.service.js).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBestTimesFromPosts } from "../services/key.service.js";

// Mardi 2026-01-06 à 8h (matin) et 2026-01-13 à 8h (matin, même créneau,
// une semaine plus tard) vs. un post isolé le dimanche à 22h (soir).
test("computeBestTimesFromPosts : identifie le créneau le plus performant", () => {
  const posts = [
    { date_posted: "2026-01-06T08:00:00.000Z", interactions: 200 },
    { date_posted: "2026-01-13T08:30:00.000Z", interactions: 240 },
    { date_posted: "2026-01-11T22:00:00.000Z", interactions: 20 },
  ];
  const { items, globalAvg } = computeBestTimesFromPosts(posts);

  assert.ok(globalAvg > 0);
  const best = items[0];
  assert.equal(best.day, new Date("2026-01-06T08:00:00.000Z").getDay());
  assert.equal(best.sampleSize, 2);
  assert.ok(best.impactIndex > 1);
});

test("computeBestTimesFromPosts : ignore les dates invalides ou manquantes", () => {
  const posts = [
    { date_posted: null, interactions: 100 },
    { date_posted: "pas une date", interactions: 100 },
    { date_posted: "2026-02-02T10:00:00.000Z", interactions: 50 },
  ];
  const { items } = computeBestTimesFromPosts(posts);
  const total = items.reduce((s, i) => s + i.sampleSize, 0);
  assert.equal(total, 1);
});

test("computeBestTimesFromPosts : tableau vide -> aucun créneau, moyenne à 0", () => {
  const { items, globalAvg } = computeBestTimesFromPosts([]);
  assert.deepEqual(items, []);
  assert.equal(globalAvg, 0);
});
