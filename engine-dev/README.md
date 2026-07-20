# Engine Dev

Módulo técnico do Binaural Flow com motor de áudio, ciclo de vida móvel e interface principal do reprodutor.

## Situação das etapas

- ETAPA 02: motor binaural concluído;
- ETAPA 03: ciclo de vida móvel e recuperação concluídos;
- ETAPA 04: interface principal do reprodutor implementada.

## Interface principal

A interface usa exclusivamente a API pública do `AudioEngine`. Ela não acessa diretamente `AudioContext`, osciladores, ganhos, merger, compressor ou parâmetros de áudio.

Recursos visuais e operacionais:

- experiência mobile-first em Glassmorphism;
- visualizador holográfico em Canvas;
- knobs independentes para os canais L e R;
- ajuste por toque, arraste, mouse, roda e teclado;
- cálculo em tempo real de `R − L`;
- identificação visual de Near Mono, Delta, Theta, Alpha, Beta e Gamma;
- transição cromática suave de dois segundos;
- reprodução, pausa, retomada, parada e restauração;
- volume limitado pelo teto de segurança do motor;
- timer baseado no estado real da sessão;
- diagnóstico técnico em gaveta recolhível;
- recuperação após suspensão externa;
- controles de atualização segura da PWA.

A interface não implementa catálogo, favoritos, histórico, sons ambientes, ruídos, batidas isocrônicas, importação, exportação ou backend.

## Características do núcleo

- TypeScript estrito;
- nenhuma criação automática de `AudioContext`;
- um contexto por instância de motor;
- dois osciladores senoidais independentes;
- roteamento por `ChannelMergerNode`;
- master gain e ganhos por canal;
- limiter de proteção;
- fade-in, fade-out e rampas de frequência;
- máquina de estados explícita;
- pausa manual diferenciada de suspensão externa;
- Wake Lock e Media Session opcionais;
- atualização de PWA sem recarga automática durante sessão;
- testes com mocks mínimos da Web Audio API.

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

Após o build, a interface compilada fica em `engine-dev/dist`. O preview local usa `http://127.0.0.1:4173`.
