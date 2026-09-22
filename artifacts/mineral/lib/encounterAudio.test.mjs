import assert from "node:assert/strict";

import {
  exitEncounterAfterPersist,
  persistEncounterAudioPosition,
  startEncounterAudio,
} from "./encounterAudio.ts";

function releasedPlayer() {
  return {
    get currentTime() {
      throw new Error("NativeSharedObjectNotFoundException");
    },
  };
}

// Start exit: zero has nothing useful to persist, and a released native getter
// is never needed when the JS snapshot is available.
{
  let getterRead = false;
  const player = {
    get currentTime() {
      getterRead = true;
      throw new Error("NativeSharedObjectNotFoundException");
    },
  };
  let saves = 0;
  assert.doesNotThrow(() => {
    const persisted = persistEncounterAudioPosition({
      enabled: true,
      lastKnownPosition: 0,
      completed: false,
      player,
      save: () => {
        saves += 1;
      },
    });
    assert.equal(persisted, null);
  });
  assert.equal(getterRead, false);
  assert.equal(saves, 0);
}

// Mid-audio exit prefers the last status snapshot even after native release.
{
  const saved = [];
  const persisted = persistEncounterAudioPosition({
    enabled: true,
    lastKnownPosition: 37.25,
    completed: false,
    player: releasedPlayer(),
    save: (seconds) => saved.push(seconds),
  });
  assert.equal(persisted, 37.25);
  assert.deepEqual(saved, [37.25]);
}

// End exit clears any older midpoint so reopening starts cleanly.
{
  const saved = [];
  const persisted = persistEncounterAudioPosition({
    enabled: true,
    lastKnownPosition: 89,
    completed: true,
    player: releasedPlayer(),
    save: (seconds) => saved.push(seconds),
  });
  assert.equal(persisted, 0);
  assert.deepEqual(saved, [0]);
}

// If no JS snapshot exists, a dead native getter is contained.
{
  assert.doesNotThrow(() => {
    assert.equal(
      persistEncounterAudioPosition({
        enabled: true,
        lastKnownPosition: null,
        completed: false,
        player: releasedPlayer(),
        save: () => assert.fail("released position must not be saved"),
      }),
      null
    );
  });
}

// Persistence is invoked before navigation releases the player.
{
  const order = [];
  let released = false;
  const player = {
    get currentTime() {
      if (released) throw new Error("NativeSharedObjectNotFoundException");
      return 12;
    },
  };
  exitEncounterAfterPersist(
    () => {
      persistEncounterAudioPosition({
        enabled: true,
        lastKnownPosition: null,
        completed: false,
        player,
        save: () => order.push("persist"),
      });
    },
    () => {
      order.push("navigate");
      released = true;
    }
  );
  assert.deepEqual(order, ["persist", "navigate"]);
}

// A rejected save and an in-flight seek that loses its native object are both
// quiet async races, not unhandled exit failures.
{
  persistEncounterAudioPosition({
    enabled: true,
    lastKnownPosition: 24,
    completed: false,
    player: releasedPlayer(),
    save: async () => {
      throw new Error("offline");
    },
  });

  let release;
  const seekGate = new Promise((resolve) => {
    release = resolve;
  });
  let nativeReleased = false;
  const start = startEncounterAudio(
    {
      seekTo: async () => {
        await seekGate;
      },
      play: () => {
        if (nativeReleased) throw new Error("NativeSharedObjectNotFoundException");
      },
    },
    18,
    90
  );
  nativeReleased = true;
  release();
  await assert.doesNotReject(start);
  await new Promise((resolve) => setImmediate(resolve));
}

console.log("encounter audio lifecycle tests passed");