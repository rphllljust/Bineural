# Política de recuperação

## Regras

| Situação | Política |
|---|---|
| Pausa solicitada pelo usuário | somente o usuário retoma |
| Suspensão externa breve | tentar retomar ao voltar para a página visível |
| Retomada bloqueada | entrar em `interaction-required` e solicitar toque |
| Contexto fechado | limpar referências; reconstruir apenas após interação |
| Cadeia perdida | parar com segurança e recriar somente uma cadeia |
| Falha desconhecida | entrar em `error`, emitir código técnico e mensagem amigável |
| Recarregamento | não retomar automaticamente; preservar apenas configuração serializável |
| Atualização da PWA durante sessão | marcar como `deferred`; não recarregar |

## Preservação do tempo

Enquanto o mesmo contexto permanece suspenso, `currentTime` preserva a posição de áudio. Quando o contexto é fechado, o módulo utiliza a última posição conhecida como referência, mas não promete precisão absoluta após reconstrução.

## Segurança na recuperação

Toda retomada externa aplica uma rampa a partir do ganho mínimo. O motor não retorna diretamente ao volume anterior.

## Falha de recuperação

Uma falha mantém a configuração e retorna para `interaction-required`. A UI oferece recuperação por gesto ou reinício manual. O motor não cria contextos ou osciladores repetidamente em loop.
