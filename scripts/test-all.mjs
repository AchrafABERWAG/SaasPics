// Lance toutes les suites de tests, l'une après l'autre, et affiche un résumé.
// Prérequis : npm run db:start, puis npm run dev:local dans un autre terminal.
// Usage : npm run test:all
import { spawnSync } from 'node:child_process';

const suites = [
  ['Types (tsc)', 'npx tsc --noEmit'],
  ['Lint', 'npx eslint --max-warnings 10'],
  ['Base de données (pgTAP)', 'npm run -s db:test'],
  ['Parcours invité / admin (smoke)', 'npm run -s smoke'],
  ['Paiements Stripe (test)', 'npm run -s test:payment'],
  ['Emails', 'npm run -s test:emails'],
  ['Packs et limites', 'npm run -s test:plans'],
  ['Espace Pro', 'npm run -s test:pro'],
  ['Légal / RGPD', 'npm run -s test:legal'],
];

const results = [];
for (const [name, cmd] of suites) {
  process.stdout.write(`\n=== ${name}\n`);
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  results.push([name, r.status === 0]);
}

console.log('\n================ Résumé');
for (const [name, passed] of results) console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}`);
const failed = results.filter(([, p]) => !p).length;
console.log(failed ? `\n${failed} suite(s) en échec` : '\nToutes les suites passent');
process.exit(failed ? 1 : 0);
