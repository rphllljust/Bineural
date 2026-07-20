import test from "node:test";
import assert from "node:assert/strict";
import { disposeAudioEngine, getAudioEngine } from "../src/audio/singleton.js";

test("singleton impede duplicação em remount e Strict Mode", async () => {
  const first = getAudioEngine();
  const second = getAudioEngine();
  assert.equal(first, second);
  await disposeAudioEngine();
  const third = getAudioEngine();
  assert.notEqual(first, third);
  await disposeAudioEngine();
});
