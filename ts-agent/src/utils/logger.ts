/**
 * ✨ プロジェクト共通のロギングユーティリティ ✨
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

type LogContext = Record<string, string | number | boolean>;

class Logger {
  private currentLevel: LogLevel =
    process.env.LOG_LEVEL?.toUpperCase() === "DEBUG"
      ? LogLevel.DEBUG
      : LogLevel.INFO;
  private defaultContext: LogContext = {};

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public setContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  private format(level: string, message: string, context?: LogContext): string {
    const ts = new Date().toISOString();
    const ctx = { ...this.defaultContext, ...context };
    const ctxStr = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : "";
    return `[${ts}] [${level}] ${message}${ctxStr}`;
  }

  public debug(message: string, context?: LogContext, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.debug(this.format("DEBUG", message, context), ...args);
    }
  }

  public info(message: string, context?: LogContext, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.info(this.format("INFO", message, context), ...args);
    }
  }

  public warn(message: string, context?: LogContext, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn(this.format("WARN", message, context), ...args);
    }
  }

  public error(message: string, context?: LogContext, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error(this.format("ERROR", message, context), ...args);
    }
  }

  /**
   * 特定のコンテキストを持つ子ロガーを作成するよっ！👶💖
   */
  public child(context: LogContext): Logger {
    const child = new Logger();
    child.setLevel(this.currentLevel);
    child.setContext({ ...this.defaultContext, ...context });
    return child;
  }
}

/**
 * ログ出力の「きゅーとな監視役」loggerだよっ！📢💖
 */
export const logger = new Logger();
