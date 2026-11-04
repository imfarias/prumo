import { defineConfig } from 'vitest/config';

const PRINCIPAL_SEM_ELECTRON = ['apps/desktop/src/comum/canais.ts', 'apps/desktop/src/principal/{atualizacao,preferencias,editor,menu-contexto}.ts'];

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    testTimeout: 30_000,
    // CI Linux (2 núcleos, sem GPU): vários Chromium e Electron ao mesmo tempo fazem a renderização variar
    // entre capturas; lá os arquivos rodam um de cada vez.
    fileParallelism: !(process.env.CI && process.platform === 'linux'),
    coverage: {
      provider: 'v8',
      include: ['packages/motor/src/**/*.ts', ...PRINCIPAL_SEM_ELECTRON],
      reporter: ['text-summary', 'text'],
      thresholds: {
        'packages/motor/src/**/*.ts': { lines: 85, branches: 80 },
        'apps/desktop/src/**/*.ts': { lines: 80 },
      },
    },
  },
});
