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
  // --- World Expansion v1.2 — the keep grows (Task 4): the barracks off the
  //     Great Hall. The Hall Gallery was folded INTO `great-hall` as a walked
  //     mezzanine in Task 14 (its faded Stair Door died; the retired
  //     `hall-gallery` id survives as a save alias, save.ts). ---
  | 'hall-barracks'
  // --- World Expansion v1.2 — the keep's chapel (Task 5) ---
  | 'keep-chapel'
  // --- World Expansion v1.2 — the Gate Fields watchtower (Task 6; the
  //     tower-ground + tower-upper floor-zones merged into one continuous
  //     climb in Task 13. The retired ids survive as save aliases, save.ts). ---
  | 'watchtower'
  // --- World Expansion v1.2 — the Sunken Chapel, Ashen Forest N (Task 7; the
  //     chapel-nave + chapel-crypt floor-zones merged into one walked descent in
  //     Task 16. The retired ids survive as save aliases, save.ts). ---
  | 'sunken-chapel'
  // --- World Expansion v1.2 — the Burnt Manor, Cinder Village (Task 8; the
  //     manor-ground + manor-upper floor-zones merged into one continuous climb
  //     in Task 15. The retired ids survive as save aliases, save.ts). ---
  | 'burnt-manor';

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
