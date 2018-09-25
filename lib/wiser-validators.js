const hexColorRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 *
 * @param {Object} zone - the zone definition
 * @throws {Error} if any part of the provided zone definition is invalid and error is thrown
 *
 * Validates a zone definition
 */
function validateZoneDefinition(zone) {
  if (typeof zone !== 'object') {
    throw new Error('zone must be an object');
  }
  if (zone.name && typeof !zone.name === 'string') {
    throw new Error('Error - zone name must be a string');
  }
  if (typeof zone.color !== 'undefined') {
    if (typeof zone.color !== 'string') {
      throw new Error(`${zone.name} color must be a string`);
    } else if (hexColorRegex.test(zone.color)) {
      throw new Error(
        `Error - ${zone.name} color must be a hex value including a leading #`
      );
    }
  }
  if (!Array.isArray(zone.shape)) {
    throw new Error(`Error - ${zone.name} shape must be an array`);
  }
  if (zone.shape.length < 3) {
    throw new Error(`Error - ${zone.name} shape must have at least 3 points`);
  }
  for (let i = 0; i < zone.shape.length; i++) {
    let v = zone.shape[i];
    if (
      typeof v !== 'object' ||
      Number.isNaN(Number(v.x)) ||
      Number.isNaN(Number(v.y))
    ) {
      throw new Error(
        `Error - ${
          zone.name
        } shape points must be objects with x and y values of type Number`
      );
    }
  }
}

module.exports = {
  validateZoneDefinition
};
