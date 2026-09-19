import assert from 'node:assert/strict';
import test from 'node:test';

// The helper module binds DOM listeners at import time; no page is needed for
// these pure derived-data checks.
globalThis.document = { querySelectorAll: () => [], getElementById: () => null };
const {
  addMoistureVectors,
  trailingPrecipitation,
  addHeightContours,
  consultationComposite
} = await import('../web/moisture.mjs');

test('samples finite 850 hPa moisture flux components every two grid cells', () => {
  const qu = [[3, 9, 0], [8, 8, 8], [NaN, 7, -5]];
  const qv = [[4, 9, 2], [8, 8, 8], [1, 7, 12]];
  const vectors = addMoistureVectors(qu, qv);
  assert.deepEqual(vectors.map(({ r, c, magnitude }) => [r, c, magnitude]), [
    [0, 0, 5], [0, 2, 2], [2, 2, 13]
  ]);
  assert.deepEqual([vectors[0].lat, vectors[0].lon, vectors[0].mag], [15, 75, 5]);
  assert.equal(vectors[0].angle, Math.atan2(4, 3) * 180 / Math.PI);
  assert.ok(vectors.every(({ className }) => className === 'moisture-vector-arrow'));
});

test('sums exactly the selected 24-hour precipitation window', () => {
  const hourly = { precipitation: [100, ...Array(24).fill(2), 100] };
  assert.equal(trailingPrecipitation(hourly, 1), 48);
});

test('labels the 500 hPa height layer as derived without changing its field', async () => {
  const field = [[5520, 5580], [5640, 5700]];
  const layer = addHeightContours(field);
  assert.equal(layer.type, 'height-contours');
  assert.equal(layer.derived, true);
  assert.equal(layer.field, field);

  const composite = await consultationComposite({
    geopotential_height_500hPa: field,
    moistureFlux850: [5, 8],
    precipitation: 48
  });
  assert.equal(composite.height.field, field);
  assert.deepEqual(composite.moisture, [5, 8]);
  assert.equal(composite.precipitation, 48);
  assert.match(composite.note, /采样网格.*derived/);
});
