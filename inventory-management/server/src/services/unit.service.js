const { Unit } = require('../models');
const { DEFAULT_UNITS, UNIT_ALIASES, unitKey } = require('../utils/units');

let cache = null;

async function ensureDefaultUnits() {
  const ops = DEFAULT_UNITS.map((u) => ({
    updateOne: {
      filter: { key: unitKey(u.name) },
      update: { $setOnInsert: { ...u, key: unitKey(u.name), isSystem: true, isActive: true } },
      upsert: true,
    },
  }));
  await Unit.bulkWrite(ops, { ordered: false });
  invalidateUnitCache();
}

function invalidateUnitCache() {
  cache = null;
}

async function getUnitLookup() {
  if (cache) return cache;
  const units = await Unit.find({ isActive: true }).lean();
  const map = new Map();
  units.forEach((u) => map.set(u.key, u.name));
  Object.entries(UNIT_ALIASES).forEach(([alias, name]) => {
    if (!map.has(alias) && map.has(unitKey(name))) map.set(alias, map.get(unitKey(name)));
  });
  cache = map;
  return map;
}

/** Returns the canonical stored unit name (e.g. "kgs" -> "KG") or null if unknown/inactive. */
async function resolveUnit(value) {
  const key = unitKey(value);
  if (!key) return null;
  const map = await getUnitLookup();
  return map.get(key) || null;
}

module.exports = { ensureDefaultUnits, getUnitLookup, resolveUnit, invalidateUnitCache };
