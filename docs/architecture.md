# Arquitetura

## Diagnóstico inicial

Antes desta implementação, o repositório continha apenas uma demonstração estática em HTML, CSS e JavaScript. Não existiam `package.json`, TypeScript, testes, lint, build automatizado ou documentação arquitetural. Para não destruir nem substituir a demonstração existente, o núcleo técnico foi isolado em `engine-dev/`.

## Organização

```text
engine-dev/
├── src/
│   ├── audio/
│   │   ├── audio-engine.ts
│   │   ├── audio-automation.ts
│   │   ├── constants.ts
│   │   ├── errors.ts
│   │   ├── singleton.ts
│   │   ├── state-machine.ts
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   └── web-audio-adapter.ts
│   ├── lifecycle/
│   │   ├── browser-lifecycle.ts
│   │   ├── logger.ts
│   │   ├── media-session.ts
│   │   ├── pwa-update.ts
│   │   ├── types.ts
│   │   └── wake-lock.ts
│   └── main.ts
├── tests/
├── scripts/
├── index.html
└── styles.css
```

## Dependências

O motor não depende de React, UI, Service Worker ou APIs móveis. A direção de dependência é:

```text
Interface técnica
      │
      ▼
Lifecycle Coordinator ─────► Wake Lock / Media Session / PWA Update
      │
      ▼
AudioEngine
      │
      ├── validação
      ├── máquina de estados
      ├── automação de AudioParam
      └── fábrica mínima de AudioContext
```

Nenhum componente da interface acessa diretamente `AudioContext`, `OscillatorNode`, `GainNode`, `ChannelMergerNode`, `DynamicsCompressorNode`, `AudioParam` ou `AudioDestinationNode`.

## Instância única

`singleton.ts` fornece uma instância estável do motor. O construtor não cria `AudioContext`. Isso evita duplicação em remount e em React Strict Mode quando o módulo for integrado futuramente.

## Estratégia de teste

A abstração cobre somente os membros utilizados da Web Audio API. Os mocks registram criação, conexões, automações, suspensão, retomada, encerramento e avanço controlado do relógio do áudio.
