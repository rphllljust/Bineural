# Motor de áudio binaural

## Decisão de frequência

A estratégia principal é:

```text
canal esquerdo = frequência portadora
canal direito  = frequência portadora + diferença binaural
```

A configuração direta L/R existe por união discriminada (`mode: "direct"`) e não pode ser combinada com portadora/diferença na mesma configuração. Assim, não existe ambiguidade entre os dois modos.

## Topologia

```text
Oscilador esquerdo
        │
        ▼
Ganho esquerdo
        │
        └──────────────► entrada 0 do ChannelMerger

Oscilador direito
        │
        ▼
Ganho direito
        │
        └──────────────► entrada 1 do ChannelMerger

ChannelMerger
        │
        ▼
MasterGain
        │
        ▼
DynamicsCompressor (limiter de proteção)
        │
        ▼
AudioDestination
```

`StereoPannerNode` não é utilizado como mecanismo principal.

## API pública

- `initialize()`
- `start(config)`
- `pause()`
- `resume()`
- `recover(userGesture)`
- `stop()`
- `setMasterVolume(value)`
- `setChannelVolume(channel, value)`
- `setCarrierFrequency(value)`
- `setBinauralFrequency(value)`
- `setChannelFrequency(channel, value)`
- `getState()`
- `subscribe(listener)`
- `dispose()`

## Estados

Estados implementados:

- `uninitialized`
- `idle`
- `starting`
- `running`
- `pausing`
- `paused`
- `resuming`
- `stopping`
- `interrupted`
- `recovering`
- `interaction-required`
- `error`
- `disposed`

Chamadas repetidas de `initialize`, `pause` já concluída, `resume` já concluído e `stop` em `idle` são idempotentes. Início duplicado é rejeitado. Uso após `dispose` gera erro de domínio.

## Limites padrão

| Parâmetro | Mínimo | Máximo |
|---|---:|---:|
| Portadora | 80 Hz | 500 Hz |
| Diferença binaural | 0,5 Hz | 40 Hz |
| Frequência de canal | 80 Hz | 540 Hz |
| Master volume | 0 | 0,30 |
| Volume por canal | 0 | 1,00 |
| Fade | 0,02 s | 5 s |
| Transição | 0,01 s | 3 s |
| Duração | 1 s | 14.400 s |

A política é rejeitar valores inválidos com `AudioEngineError`. Valores potencialmente perigosos não são corrigidos silenciosamente.

## Segurança de ganho

O volume inicial padrão é `0,08`. O teto global é `0,30`. Os canais são isolados pelo merger, cada um com ganho padrão `0,5`. O limiter é proteção técnica, não efeito artístico:

- threshold: `-18 dB`;
- knee: `6 dB`;
- ratio: `12:1`;
- attack: `0,003 s`;
- release: `0,25 s`.

Esses valores reduzem transientes inesperados sem tentar masterizar o sinal.

## Estratégia anti-estalo

A automação usa:

- `cancelAndHoldAtTime`, quando disponível;
- fallback com `cancelScheduledValues` e `setValueAtTime`;
- `linearRampToValueAtTime` para ganho e frequência;
- ganho mínimo positivo `0,0001` em vez de zero em rampas.

O motor inicia no ganho mínimo, aplica fade-in e somente chama `OscillatorNode.stop()` no instante final do fade-out.

## Temporização

A duração e o encerramento são agendados com `AudioContext.currentTime`. O intervalo JavaScript é usado somente para eventos de progresso da UI. Se a aba sofrer throttling, o próximo evento é corrigido pelo relógio do áudio.

## Limpeza

Após término manual ou automático:

1. o envelope de saída chega ao ganho mínimo;
2. os dois osciladores terminam;
3. todos os nós são desconectados;
4. referências da cadeia são removidas;
5. o intervalo de progresso é cancelado;
6. o estado retorna para `idle`.

Osciladores encerrados nunca são reutilizados.

## Erros de domínio

São definidos códigos para API indisponível, configuração inválida, transição inválida, falha de início, suspensão, retomada, contexto fechado, motor descartado, criação de nós, interação requerida e recuperação.
