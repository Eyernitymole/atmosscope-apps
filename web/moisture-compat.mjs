// Compatibility layer for professional atlas products
// Keeps legacy moisture diagnostics untouched.

export function addMoistureVectors(vectors = []) {
  if (!Array.isArray(vectors)) return [];
  return vectors.map(item => ({
    lat: Number(item.lat),
    lon: Number(item.lon),
    u: Number(item.u || 0),
    v: Number(item.v || 0),
    magnitude: Number(item.magnitude || 0)
  }));
}

export function trailingPrecipitation(hours = 72) {
  return {
    hours,
    label: `${hours}小时累计降水`,
    type: 'accumulated precipitation'
  };
}
