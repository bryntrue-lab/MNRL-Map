export type EncounterAudioPlayer = {
  readonly currentTime: number;
  seekTo(seconds: number): Promise<void>;
  play(): void;
};

type PersistAudioPositionOptions = {
  enabled: boolean;
  lastKnownPosition: number | null;
  completed: boolean;
  player: Pick<EncounterAudioPlayer, "currentTime">;
  save: (seconds: number) => Promise<unknown> | unknown;
};

/**
 * Persist from the JS status snapshot whenever possible. expo-audio releases
 * its native shared object during unmount, so even reading currentTime can
 * throw once teardown has begun.
 */
export function persistEncounterAudioPosition({
  enabled,
  lastKnownPosition,
  completed,
  player,
  save,
}: PersistAudioPositionOptions): number | null {
  if (!enabled) return null;

  let seconds = completed ? 0 : lastKnownPosition;
  if (!Number.isFinite(seconds) || (seconds as number) < 0) {
    try {
      seconds = player.currentTime;
    } catch {
      return null;
    }
  }

  if (!Number.isFinite(seconds) || (seconds as number) < 0) return null;
  if (!completed && seconds === 0) return null;

  try {
    // Firestore persistence is deliberately best-effort. Attach the rejection
    // handler before navigation can unmount this screen.
    void Promise.resolve(save(seconds as number)).catch(() => {});
  } catch {
    // A resume position must never be able to block or crash encounter exit.
  }
  return seconds as number;
}

/** Keep persistence invocation ahead of navigation/native player teardown. */
export function exitEncounterAfterPersist(persist: () => void, navigate: () => void): void {
  try {
    persist();
  } catch {
    // Navigation remains available even if an unexpected persistence error occurs.
  }
  navigate();
}

/** Seek/play can race an unmount while the native seek promise is in flight. */
export async function startEncounterAudio(
  player: Pick<EncounterAudioPlayer, "seekTo" | "play">,
  position: number,
  duration: number
): Promise<void> {
  try {
    if (position > 0 && position < duration - 2) await player.seekTo(position);
    player.play();
  } catch {
    // A released player or failed seek is a quiet no-op during teardown.
  }
}