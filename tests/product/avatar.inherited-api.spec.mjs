// sl-avatar's inherited-API tests (support/inherited-api.mjs), in a file of its own so that CI's shards spread them (see
// inherited-api.spec.mjs).
import { inheritedApiTests } from './support/inherited-api.mjs';

inheritedApiTests('sl-avatar');
