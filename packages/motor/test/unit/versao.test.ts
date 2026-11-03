import { describe, expect, it } from 'vitest';
import { VERSAO_MODELO } from '../../src/index.js';

describe('motor', () => {
  it('expõe a versão do contrato do modelo em semver', () => {
    expect(VERSAO_MODELO).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
