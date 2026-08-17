/**
 * Tests du calcul de score d'impact par dimension (services/key.service.js)
 * — le cœur de "Caractéristiques" : quelle valeur (pattern, hook, style...)
 * est statistiquement associée aux meilleures performances.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { avg, canonical, computeImpactIndex } from "../services/key.service.js";

test("avg : moyenne simple, 0 sur un tableau vide", () => {
  assert.equal(avg([10, 20, 30]), 20);
  assert.equal(avg([]), 0);
});

test("canonical : insensible aux accents et à la casse (même slug)", () => {
  assert.equal(canonical("Pédagogique"), canonical("pedagogique"));
  assert.equal(canonical("Storytelling personnel"), "storytelling personnel");
});

test("canonical : la ponctuation ne casse pas le regroupement", () => {
  assert.equal(canonical("Avant – Après – Pont"), canonical("Avant Apres Pont"));
});

test("computeImpactIndex : 1.0 quand la valeur est exactement dans la moyenne globale", () => {
  const { impactIndex } = computeImpactIndex([100, 100], 100);
  assert.equal(impactIndex, 1);
});

test("computeImpactIndex : > 1 quand la valeur performe mieux que la moyenne", () => {
  const { avgInteractions, impactIndex } = computeImpactIndex([150, 150], 100);
  assert.equal(avgInteractions, 150);
  assert.equal(impactIndex, 1.5);
});

test("computeImpactIndex : < 1 quand la valeur performe moins bien", () => {
  const { impactIndex } = computeImpactIndex([50], 100);
  assert.equal(impactIndex, 0.5);
});

test("computeImpactIndex : 0 sans donnée, jamais de division par zéro", () => {
  assert.deepEqual(computeImpactIndex([], 0), { avgInteractions: 0, impactIndex: 0 });
  assert.deepEqual(computeImpactIndex([], 100), { avgInteractions: 0, impactIndex: 0 });
});
