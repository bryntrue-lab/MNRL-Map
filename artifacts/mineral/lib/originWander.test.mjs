import assert from "node:assert/strict";

import {
  MAX_AGE,
  MAX_DATE_AGE,
  YEARS_PER_TURN,
  ageAt,
  dateAtAge,
  originAgeForDate,
  originDateInRange,
  originDateRange,
  originNeedleAgeAt,
  originWanderFrame,
  seasonTitleForAge,
} from "./spiral.ts";

const birth = new Date(1990, 1, 28, 12);

// The selector starts at birth and reaches one complete 28-year cycle beyond
// today, while the map's supported pre-turn-four position remains the hard
// upper boundary.
{
  const today = new Date(2024, 1, 28, 12);
  const range = originDateRange(birth, today);
  assert.equal(range.minimumDate.getTime(), birth.getTime());
  assert.equal(range.maximumDate.getFullYear(), 2052);
  assert.equal(range.maximumDate.getMonth(), 1);
  assert.equal(range.maximumDate.getDate(), 28);
}

// At the far end of the three-cycle map, the map horizon wins over today + 28.
{
  const leapBirth = new Date(2000, 1, 29, 12);
  const today = new Date(2060, 1, 28, 12);
  const range = originDateRange(leapBirth, today);
  assert.equal(
    range.maximumDate.getTime(),
    dateAtAge(leapBirth, MAX_DATE_AGE).getTime()
  );
  assert.equal(
    originDateInRange(new Date(2200, 0, 1, 12), range).getTime(),
    range.maximumDate.getTime()
  );
  assert.equal(
    originDateInRange(new Date(1900, 0, 1, 12), range).getTime(),
    range.minimumDate.getTime()
  );
}

// Date selection keeps exact boundary dates; only the drag path has the .2
// off-still-point guard.
{
  assert.equal(originAgeForDate(birth, birth), 0);
  assert.ok(Math.abs(originAgeForDate(birth, new Date(2018, 1, 28, 12)) - ageAt(birth, new Date(2018, 1, 28, 12))) < 0.001);
  assert.equal(originAgeForDate(birth, new Date(2200, 0, 1, 12)), MAX_DATE_AGE);
  assert.equal(originAgeForDate(birth, dateAtAge(birth, MAX_DATE_AGE)), MAX_DATE_AGE);
}

// The wander headline follows season boundaries, not the ring station.
{
  assert.equal(seasonTitleForAge(6.99), "The First Weather");
  assert.equal(seasonTitleForAge(0), "The First Weather");
  assert.equal(seasonTitleForAge(7), "The Edges of the World");
  assert.equal(seasonTitleForAge(27.99), "The Door Appears");
  assert.equal(seasonTitleForAge(YEARS_PER_TURN), "The Chosen Ground");
  assert.equal(seasonTitleForAge(55.99), "The Seed Remembers");
  assert.equal(seasonTitleForAge(YEARS_PER_TURN * 2), "Becoming the Weather");
  assert.equal(seasonTitleForAge(MAX_DATE_AGE), "The Open Door");
  assert.equal(seasonTitleForAge(MAX_AGE), null);
}

// Needle position, metadata, and caption are projected from one animated age.
// The title correctly holds inside a season, then changes at the exact boundary.
{
  const before = originWanderFrame(birth, 6.99);
  const boundary = originWanderFrame(birth, 7);
  const laterInSameSeason = originWanderFrame(birth, 7.4);

  assert.equal(before.age, 6.99);
  assert.match(before.meta, /age 7\.0 · cycle one · year six$/);
  assert.equal(before.seasonTitle, "The First Weather");

  assert.equal(boundary.age, 7);
  assert.match(boundary.meta, /age 7\.0 · cycle one · year seven$/);
  assert.equal(boundary.seasonTitle, "The Edges of the World");

  assert.equal(laterInSameSeason.age, 7.4);
  assert.match(laterInSameSeason.meta, /age 7\.4 · cycle one · year seven$/);
  assert.equal(laterInSameSeason.seasonTitle, boundary.seasonTitle);
  assert.notEqual(laterInSameSeason.date.getTime(), boundary.date.getTime());
}

// Date selection uses the same quadratic settle path as the pendulum.
{
  assert.equal(originNeedleAgeAt(12, 40, 0), 12);
  assert.equal(originNeedleAgeAt(12, 40, 0.5), 26);
  assert.equal(originNeedleAgeAt(12, 40, 1), 40);
  assert.equal(originNeedleAgeAt(12, 40, 2), 40);
}

console.log("origin wander tests passed");