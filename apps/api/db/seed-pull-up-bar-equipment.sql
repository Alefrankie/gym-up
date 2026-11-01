-- Moves the exercises that hang from a bar to the `pull_up_bar` equipment category (db/catalog.ts,
-- db/catalog-extra.ts) on an already-seeded database. Safe to re-run.
-- Only these movements: weighted (`other`), band-assisted, floor and parallel-bar work keep their equipment.
-- Only system rows (owner_id IS NULL) are touched.
UPDATE exercises SET equipment = 'pull_up_bar' WHERE owner_id IS NULL AND name IN (
  'Pull Up',
  'Chin Up',
  'Wide Grip Pull Up',
  'Neutral Grip Pull Up',
  'Scapular Pull Up',
  'Muscle Up',
  'Dead Hang',
  'Hanging Leg Raise',
  'Hanging Knee Raise',
  'Toes to Bar'
);
