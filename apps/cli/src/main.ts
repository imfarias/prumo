#!/usr/bin/env node
import { Command } from 'commander';
import { VERSAO_MOTOR } from '@prumo/motor';

const programa = new Command()
  .name('prumo')
  .description('Gera protótipos, documentação e verificação a partir das especificações Gherkin.')
  .version(VERSAO_MOTOR, '-v, --version', 'mostra a versão');

programa.parse();
