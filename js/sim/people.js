// Generated people: shopper and staff looks, names and staff records. Looks are saved as small
// index sets so they survive save/load and the world can rebuild the same character.

import { PEOPLE, STAFF_ROLES, STAFF_NAMES } from '../data.js';

export function randomLook(game) {
  return {
    skin: game.randInt(0, PEOPLE.skin.length - 1),
    hair: game.randInt(0, PEOPLE.hair.length - 1),
    style: game.randInt(0, PEOPLE.styles.length - 1),
    top: game.randInt(0, PEOPLE.tops.length - 1),
    pants: game.randInt(0, PEOPLE.pants.length - 1),
    build: game.rand() < 0.5 ? 'a' : 'b',
  };
}

// Stats run roughly 0.8 - 1.25: speed scales walking and working, service scales how much
// shoppers enjoy dealing with them. Better people ask for a higher wage.
export function makeStaff(game, role, overrides = {}) {
  const speed = Math.round((0.85 + game.rand() * 0.38) * 100) / 100;
  const service = Math.round((0.8 + game.rand() * 0.45) * 100) / 100;
  const base = STAFF_ROLES[role].wage;
  const wage = Math.round(base * (0.8 + ((speed - 0.85) / 0.38) * 0.2 + ((service - 0.8) / 0.45) * 0.2));
  return {
    id: game.nextId('st'),
    name: game.pick(STAFF_NAMES),
    role, speed, service, wage,
    look: randomLook(game),
    hiredDay: game.state.time.day,
    shift: 'full', xp: 0, trained: 0, training: null,
    ...overrides,
  };
}
