export type ZoneId =
  | 'ashen-gate'
  | 'great-hall'
  | 'undercroft'
  | 'ramparts'
  | 'throne'
  | 'summit'
  | 'queens-garden'
  // --- Greater Vael Drop 1 — "The Fields" (append only; never reorder above) ---
  | 'gate-fields'
  | 'ashen-forest-n'
  | 'cinder-village'
  | 'pilgrims-descent'
  // Drop 2 target — authored-but-unbuilt, lives in FUTURE_ZONE_IDS.
  | 'salt-road'
  // --- World Expansion v1.2 — the keep grows (Task 4): the keep's upper floors ---
  | 'hall-gallery'
  | 'hall-barracks'
  // --- World Expansion v1.2 — the keep's chapel (Task 5) ---
  | 'keep-chapel'
  // --- World Expansion v1.2 — the Gate Fields watchtower (Task 6) ---
  | 'tower-ground'
  | 'tower-upper'
  // --- World Expansion v1.2 — the Sunken Chapel, Ashen Forest N (Task 7) ---
  | 'chapel-nave'
  | 'chapel-crypt';

export type EnemyKind = 'soldier' | 'archer' | 'wraith' | 'forsworn' | 'hound' | 'kneeler';

export type EndingId = 1 | 2 | 3 | 4;

export type GameFlag =
  | 'gatekey'
  | 'shortcut-open'
  | 'throne-open'
  | 'forsworn-dead'
  | 'forsworn-noguard'
  | 'queens-brand'
  | 'garden-found'
  | 'ng-plus'
  | 'callun-tachi'
  | 'wraith-hunt-done'
  // --- Greater Vael Drop 1 (append only) ---
  | 'greater-vael-open'
  | 'hag-tithed'
  | 'hag-ledger-given'
  | 'hag-kneeled'
  | 'tithe-ledger';
