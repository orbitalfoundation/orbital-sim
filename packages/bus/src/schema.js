import logger from '@orbital/utils';

export const schemaHandler = {
  id: 'bus.schema',
  resolve(event, bus) {
    if (!event.schema || typeof event.schema !== 'object') return;
    for (const key of Object.keys(event.schema)) {
      const existing = bus.schemas.get(key);
      if (existing && existing !== event) {
        logger.warn(`bus: schema collision on '${key}' — already claimed by '${existing._claimant}'`);
      } else {
        bus.schemas.set(key, { ...event.schema[key], _claimant: event.id || '(anonymous)' });
      }
    }
  },
};
