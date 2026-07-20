import type { AudioEngineErrorCode, AudioEngineErrorContext } from "./types.js";

const FRIENDLY_MESSAGES: Readonly<Record<AudioEngineErrorCode, string>> = {
  AUDIO_API_UNAVAILABLE: "O navegador não oferece suporte ao áudio necessário.",
  INVALID_CONFIGURATION: "Revise as frequências, o volume e a duração informados.",
  INVALID_STATE_TRANSITION: "Essa ação não está disponível no estado atual.",
  START_FAILED: "Não foi possível iniciar o áudio. Toque novamente para tentar.",
  SUSPEND_FAILED: "Não foi possível pausar a sessão.",
  RESUME_FAILED: "Não foi possível retomar a sessão. Um novo toque pode ser necessário.",
  CONTEXT_CLOSED: "O sistema de áudio foi encerrado pelo navegador.",
  ENGINE_DISPOSED: "O motor de áudio já foi encerrado.",
  NODE_CREATION_FAILED: "Não foi possível preparar os canais de áudio.",
  INTERACTION_REQUIRED: "O navegador exige uma nova interação para liberar o áudio.",
  RECOVERY_FAILED: "A sessão não pôde ser recuperada automaticamente. Reinicie manualmente."
};

export class AudioEngineError extends Error {
  readonly code: AudioEngineErrorCode;
  readonly context: AudioEngineErrorContext;
  override readonly cause?: unknown;

  constructor(
    code: AudioEngineErrorCode,
    message: string,
    context: AudioEngineErrorContext,
    cause?: unknown
  ) {
    super(message);
    this.name = "AudioEngineError";
    this.code = code;
    this.context = context;
    if (cause !== undefined) this.cause = cause;
  }

  toFriendlyMessage(): string {
    return FRIENDLY_MESSAGES[this.code];
  }
}
