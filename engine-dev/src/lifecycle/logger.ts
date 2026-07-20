export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LocalLogEntry {
  readonly timestamp: number;
  readonly level: LogLevel;
  readonly event: string;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
}

export class LocalLifecycleLogger {
  private readonly entries: LocalLogEntry[] = [];

  constructor(
    private readonly now: () => number,
    private readonly capacity = 200
  ) {}

  record(
    level: LogLevel,
    event: string,
    data?: Readonly<Record<string, string | number | boolean>>
  ): void {
    this.entries.push(Object.freeze({
      timestamp: this.now(),
      level,
      event,
      ...(data === undefined ? {} : { data })
    }));
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
  }

  snapshot(): readonly LocalLogEntry[] {
    return this.entries.slice();
  }

  clear(): void {
    this.entries.length = 0;
  }
}
