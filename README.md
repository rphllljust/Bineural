# Binaural Flow

Projeto pessoal de geração de áudio binaural para tablet e notebook.

## Situação atual

O repositório possui duas áreas independentes:

- a demonstração visual existente na raiz, preservada sem remoções;
- o módulo técnico `engine-dev/`, criado para as ETAPAS 02 e 03.

O módulo técnico contém um motor binaural em TypeScript independente de framework, máquina de estados explícita, validação de segurança, testes automatizados, interface temporária de diagnóstico e tratamento progressivo do ciclo de vida móvel.

## Executar o módulo técnico

```bash
cd engine-dev
npm install
npm run typecheck
npm run lint
npm test
npm run coverage
npm run build
npm run preview
```

A interface temporária ficará disponível em `http://127.0.0.1:4173` após o build e o preview.

## Segurança

- Utilize fones estéreo.
- Comece em volume baixo.
- Não utilize dirigindo ou operando máquinas.
- Interrompa em caso de desconforto.
- O sistema não constitui tratamento médico.

## Documentação

- `docs/architecture.md`
- `docs/audio-engine.md`
- `docs/mobile-lifecycle.md`
- `docs/browser-compatibility.md`
- `docs/recovery-policy.md`

## Escopo preservado

As ETAPAS 02 e 03 não implementam catálogo definitivo, favoritos, histórico, sons ambientes, ruídos coloridos, batidas isocrônicas, editor avançado, backend ou sincronização.
