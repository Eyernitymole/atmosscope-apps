import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizePlaces, normalizeForecast, weatherLabel} from '../web/ordinary-data.mjs';

test('geocoding retains distinct same-name places and ignores invalid coordinates', () => {
  const places = normalizePlaces({results: [
    {name: 'Springfield', admin1: 'A', country: 'US', latitude: 1, longitude: 2},
    {name: 'Springfield', admin1: 'B', country: 'US', latitude: 3, longitude: 4},
    {name: 'Bad', latitude: 91, longitude: 1},
  ]});
  assert.deepEqual(places.map(place => place.admin1), ['A', 'B']);
  assert.deepEqual(normalizePlaces({}), []);
});

test('forecast preserves future hourly rain, daily city dates and absent values', () => {
  const base = 1_780_000_000;
  const time = Array.from({length: 50}, (_, i) => base - 3600 + i * 3600);
  const rain = Array(50).fill(0);
  rain[2] = null;
  const forecast = normalizeForecast({
    timezone: 'Asia/Shanghai',
    current: {time: base, temperature_2m: 23},
    hourly: {time, temperature_2m: Array(50).fill(23), precipitation: rain},
    daily: {
      time: [Date.UTC(2026, 8, 19, 16) / 1000, Date.UTC(2026, 8, 20, 16) / 1000],
      temperature_2m_max: [29],
    },
  }, {nowMs: base * 1000});
  assert.equal(forecast.hours.length, 24);
  assert.equal(forecast.hours[0].timestamp, base);
  assert.equal(forecast.hours[0].precipitation, 0);
  assert.equal(forecast.hours[1].precipitation, null);
  assert.equal(forecast.days[0].date, '2026-09-20');
  assert.equal(forecast.days[1].high, null);
  assert.equal(weatherLabel(999), '未分类天气');
});

test('bad time zones and missing arrays leave safe empty results', () => {
  const forecast = normalizeForecast({timezone: 'Invalid/Zone', current: {temperature_2m: null}},
    {nowMs: 1_780_000_000_000});
  assert.equal(forecast.timeZone, 'UTC');
  assert.equal(forecast.current.temperature, null);
  assert.deepEqual(forecast.hours, []);
  assert.deepEqual(forecast.days, []);
  assert.equal(weatherLabel(null), '未分类天气');
  assert.deepEqual(normalizeForecast({daily: {time: []}}, {nowMs: 1_780_000_000_000}).days, []);
});
