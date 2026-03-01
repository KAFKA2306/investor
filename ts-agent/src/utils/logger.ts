/**
 * ✨ プロジェクト共通のロギングユーティリティ ✨
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO;

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private format(level: string, message: string): string {
    const ts = new Date().toISOString();
    return `[${ts}] [${level}] ${message}`;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.debug(this.format("DEBUG", message), ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.info(this.format("INFO", message), ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn(this.format("WARN", message), ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error(this.format("ERROR", message), ...args);
    }
  }
}

/**
 * ログ出力の「きゅーとな監視役」loggerだよっ！📢💖
 */
export const logger = new Logger();
