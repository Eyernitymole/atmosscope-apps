import assert from 'node:assert/strict';
import test from 'node:test';
import {isStoredCity, createRequestOwner} from '../web/ordinary.mjs';

test('saved city rejects invalid coordinates and accepts a selected place', () => {
  assert.equal(isStoredCity(null), false);
  assert.equal(isStoredCity({name: 'Bad', latitude: 100, longitude: 2}), false);
  assert.equal(isStoredCity({name: '广州', latitude: 23.1291, longitude: 113.2644}), true);
});

test('new requests abort and supersede earlier search or forecast', () => {
  const owner = createRequestOwner();
  const first = owner.next();
  const second = owner.next();
  assert.equal(first.signal.aborted, true);
  assert.equal(owner.current(first.id), false);
  assert.equal(owner.current(second.id), true);
});
