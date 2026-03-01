export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ProviderConfigError extends ProviderError {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

export class ProviderHttpError extends ProviderError {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(`[HTTP ${status}] ${url}: ${message}`);
    this.name = "ProviderHttpError";
  }
}

export class ProviderPayloadError extends ProviderError {
  constructor(message: string) {
    super(message);
    this.name = "ProviderPayloadError";
  }
}
