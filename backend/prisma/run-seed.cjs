// Compile puis exécute prisma/seed.ts. Le client Prisma généré importe ses
// fichiers avec l'extension .js, ce que ts-node ne sait pas résoudre : on
// passe donc par tsc (tsconfig.seed.json) puis on lance le JS produit.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
/** Exécute une commande dans le dossier backend en affichant sa sortie ; échoue si elle retourne une erreur. */
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.seed.json']);
run('node', ['dist-seed/prisma/seed.js']);
