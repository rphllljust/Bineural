# Compatibilidade esperada

Esta matriz registra comportamento esperado a partir das APIs utilizadas. Não substitui homologação em dispositivos reais.

| Ambiente | AudioContext / gesto | Segundo plano e bloqueio | Wake Lock | Media Session | PWA / Service Worker | Situação |
|---|---|---|---|---|---|---|
| Chrome Android | exige gesto no primeiro início | pode suspender ao trocar de app ou bloquear | progressivo | geralmente disponível | disponível em HTTPS | implementação preparada; dispositivo real não testado |
| Chromium em tablet | exige gesto | depende do fabricante e economia de bateria | progressivo | normalmente disponível | disponível em HTTPS | dispositivo real não testado |
| Safari iPadOS | exige gesto; retomada pode exigir novo toque | bloqueio e troca de app podem interromper | suporte variável por versão | suporte parcial/variável | Tela de Início com limitações próprias | não testado; pendente de homologação |
| Chrome Windows | gesto no primeiro início | minimização pode reduzir timers, mas áudio costuma continuar | suporte depende da versão | disponível | disponível em HTTPS | preview estático testado; áudio real não testado neste ambiente |
| Edge Windows | comportamento Chromium | semelhante ao Chrome | progressivo | disponível | disponível em HTTPS | não testado com áudio real |
| Firefox desktop | Web Audio disponível | políticas e suspensão podem variar | suporte limitado | suporte variável | Service Worker disponível | não testado com áudio real |
| Safari macOS | gesto e políticas próprias | suspensão possível | suporte variável | suporte variável | Service Worker disponível | não testado |

## Limitações reais

- Nenhum navegador garante áudio contínuo com tela bloqueada.
- iPadOS pode suspender a PWA e exigir novo toque.
- Wake Lock mantém a tela ativa, mas não controla a política de áudio do sistema.
- Alterações Bluetooth, chamadas, alarmes e assistentes de voz não são totalmente observáveis pela Web Audio API.
- A identificação da saída de áudio é limitada sem permissões que o projeto deliberadamente não solicita.
