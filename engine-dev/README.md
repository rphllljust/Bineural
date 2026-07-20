# Engine Dev

Interface temporária e módulo técnico das ETAPAS 02 e 03.

## Características

- TypeScript estrito;
- nenhuma criação automática de `AudioContext`;
- um contexto por instância de motor;
- dois osciladores senoidais independentes;
- roteamento por `ChannelMergerNode`;
- master gain e ganhos por canal;
- limiter de proteção;
- fade-in, fade-out e rampas de frequência;
- máquina de estados explícita;
- eventos tipados;
- pausa manual diferenciada de suspensão externa;
- Wake Lock opcional;
- Media Session opcional;
- atualização de PWA sem recarga automática durante sessão;
- testes sem áudio real por meio de mocks mínimos da Web Audio API.

## Comandos

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run coverage
npm run build
npm run preview
```

O lint técnico é executado por script local, sem dependência de plugin. Os testes utilizam o runner nativo do Node após compilação TypeScript.
