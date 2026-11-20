// URL du site local à tester : TEST_SITE_URL, sinon celle annoncée par `npm run dev:local`.
import { existsSync, readFileSync } from 'node:fs';

export function testSiteUrl() {
  if (process.env.TEST_SITE_URL) return process.env.TEST_SITE_URL;
  if (existsSync('.dev-local-url')) return readFileSync('.dev-local-url', 'utf8').trim();
  return 'http://localhost:3001';
}
