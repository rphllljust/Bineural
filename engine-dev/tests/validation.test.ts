import test from "node:test";
import assert from "node:assert/strict";
import { AudioEngineError } from "../src/audio/errors.js";
import { resolveSessionConfiguration } from "../src/audio/validation.js";

const base = {
  mode: "carrier-offset" as const,
  carrierHz: 200,
  binauralHz: 6,
  masterVolume: 0.08,
  leftVolume: 0.5,
  rightVolume: 0.5,
  durationSeconds: 60,
  fadeInSeconds: 1,
  fadeOutSeconds: 0.3,
  transitionSeconds: 0.08
};

test("calcula canal esquerdo como portadora e direito como portadora mais diferença", () => {
  const resolved = resolveSessionConfiguration(base, "idle");
  assert.equal(resolved.leftHz, 200);
  assert.equal(resolved.rightHz, 206);
  assert.equal(resolved.binauralHz, 6);
});

test("aceita configuração direta sem ambiguidade", () => {
  const resolved = resolveSessionConfiguration({
    mode: "direct",
    leftHz: 180,
    rightHz: 188,
    durationSeconds: 60
  }, "idle");
  assert.equal(resolved.carrierHz, 180);
  assert.equal(resolved.binauralHz, 8);
});

test("rejeita portadora fora do limite", () => {
  assert.throws(
    () => resolveSessionConfiguration({ ...base, carrierHz: 20 }, "idle"),
    (error: unknown) => error instanceof AudioEngineError && error.code === "INVALID_CONFIGURATION"
  );
});

test("rejeita diferença binaural perigosa", () => {
  assert.throws(
    () => resolveSessionConfiguration({ ...base, binauralHz: 70 }, "idle"),
    (error: unknown) => error instanceof AudioEngineError && error.code === "INVALID_CONFIGURATION"
  );
});

test("rejeita volume principal acima do teto", () => {
  assert.throws(
    () => resolveSessionConfiguration({ ...base, masterVolume: 0.31 }, "idle"),
    (error: unknown) => error instanceof AudioEngineError && error.code === "INVALID_CONFIGURATION"
  );
});

test("rejeita teto de segurança acima do limite global", () => {
  assert.throws(
    () => resolveSessionConfiguration({ ...base, safety: { maxMasterVolume: 0.8 } }, "idle"),
    (error: unknown) => error instanceof AudioEngineError && error.code === "INVALID_CONFIGURATION"
  );
});

test("rejeita duração incompatível com os fades", () => {
  assert.throws(
    () => resolveSessionConfiguration({ ...base, durationSeconds: 1, fadeInSeconds: 0.8, fadeOutSeconds: 0.3 }, "idle"),
    (error: unknown) => error instanceof AudioEngineError && error.code === "INVALID_CONFIGURATION"
  );
});
