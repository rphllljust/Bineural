# Interface principal do reprodutor — ETAPA 04

## Objetivo

Substituir a interface técnica das Etapas 02–03 por uma experiência principal de reprodução sem modificar o motor de áudio ou o coordenador de ciclo de vida.

## Princípio de integração

A UI interage somente com:

- `getAudioEngine()`;
- `AudioEngine.start()`;
- `pause()`;
- `resume()`;
- `stop()`;
- `setChannelFrequency()`;
- `setMasterVolume()`;
- `getState()`;
- eventos tipados;
- `BrowserLifecycleCoordinator`.

Nenhum elemento visual acessa diretamente objetos da Web Audio API.

## Estrutura visual

A tela principal contém:

1. cabeçalho compacto;
2. cartão central em Glassmorphism;
3. visualizador holográfico em Canvas;
4. diferença binaural assinada `R − L`;
5. classificação automática da faixa;
6. dois knobs independentes;
7. controles de transporte;
8. volume e duração;
9. aviso de segurança;
10. gaveta técnica recolhível.

## Classificação visual

| Diferença absoluta | Estado | Tema |
|---|---|---|
| 0–0,5 Hz | Near Mono | cinza azulado |
| 0,5–4 Hz | Delta | verde |
| 4–8 Hz | Theta | roxo |
| 8–12 Hz | Alpha | ciano |
| 12–30 Hz | Beta | laranja |
| 30+ Hz | Gamma | magenta |

A transição das variáveis cromáticas ocorre em dois segundos.

## Knobs

Cada knob aceita:

- arraste vertical por Pointer Events;
- toque em dispositivos móveis;
- roda do mouse;
- setas do teclado;
- Page Up e Page Down para passos de 10 Hz;
- Home e End para os limites;
- botões de ajuste fino de 1 Hz.

As frequências são limitadas visualmente a 80–500 Hz. Durante uma sessão, a alteração chama `setChannelFrequency()`, que aplica a rampa no motor sem reconstruir a cadeia.

## Acessibilidade

- knobs usam `role="slider"`;
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow` e `aria-valuetext` são atualizados;
- controles possuem rótulos acessíveis;
- foco visível;
- suporte a `prefers-reduced-motion`;
- contraste elevado;
- alvos de toque dimensionados para celular.

## Escopo não antecipado

A ETAPA 04 não adiciona catálogo, favoritos, histórico, importação, exportação, sons ambientes, ruídos, batidas isocrônicas, backend ou sincronização.
