import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PRODUCT_PORT, productPort } from './support/port.mjs';

test('product preview port defaults to 4321 and accepts only an unprivileged integer', () => {
  assert.equal(DEFAULT_PRODUCT_PORT, 4321);
  assert.equal(productPort({}), 4321);
  assert.equal(productPort({ VELCRO_PRODUCT_PORT: '' }), 4321);
  assert.equal(productPort({ VELCRO_PRODUCT_PORT: '5123' }), 5123);
  assert.equal(productPort({ VELCRO_PRODUCT_PORT: '1024' }), 1024);
  assert.equal(productPort({ VELCRO_PRODUCT_PORT: '65535' }), 65535);
  for (const bad of ['0', '80', '1023', '65536', '99999', '-1', '12.5', '4321a', ' 4321', '0x10e1', 'abc', '123456']) {
    assert.throws(() => productPort({ VELCRO_PRODUCT_PORT: bad }), /VELCRO_PRODUCT_PORT/, bad);
  }
});
