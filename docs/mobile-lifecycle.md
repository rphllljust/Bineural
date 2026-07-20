# Ciclo de vida móvel

## Eventos tratados

O coordenador registra uma única vez:

- `visibilitychange`;
- `pagehide`;
- `pageshow`;
- `freeze`, quando emitido;
- `resume`, quando emitido;
- `focus` e `blur`;
- `online` e `offline`;
- `devicechange`, quando disponível.

Todos os listeners são removidos em `dispose()`.

## Pausa manual e suspensão externa

Pausa manual:

- altera o estado para `paused`;
- registra `pauseReason: manual`;
- nunca é retomada automaticamente ao voltar para a aba.

Suspensão externa:

- altera o estado para `interrupted`;
- registra `pauseReason: external`;
- preserva a intenção de reprodução;
- tenta recuperação quando a página volta a ficar visível;
- passa para `interaction-required` quando o navegador exige novo toque.

## Retomada segura

Após recuperação, o master gain volta do ganho mínimo para o volume configurado por uma rampa de `0,6 s`. A cadeia existente é reutilizada. Uma segunda cadeia não é criada.

## Relógio

O progresso real usa `AudioContext.currentTime`. Como esse relógio para durante `suspend()`, a pausa não consome a duração da sessão. O contador visual pode atrasar em segundo plano, mas se corrige no próximo evento.

## Wake Lock

Wake Lock é opcional:

- solicitado somente durante sessão ativa e página visível;
- liberado na pausa, parada e descarte;
- readquirido no retorno à visibilidade;
- falhas são registradas sem loop de tentativas;
- indisponibilidade não impede o áudio.

Manter a tela ativa aumenta o consumo de bateria e não garante áudio com a tela bloqueada.

## Media Session

Quando suportada, são configuradas ações locais de play, pause e stop, além do estado de reprodução. O motor não depende dessa API.

## Recarregamento

Durante `pagehide`, somente configuração serializável e posição aproximada são marcadas. Objetos Web Audio nunca são persistidos. Após recarregar:

- o áudio não inicia automaticamente;
- a UI informa que a sessão foi interrompida;
- um novo gesto é obrigatório.

## Mudança de saída

`devicechange` é observado quando disponível, sem solicitar microfone e sem usar `getUserMedia`. O navegador não fornece identificação confiável de toda mudança de saída; por isso a UI orienta o usuário a conferir os fones e reiniciar se necessário.
