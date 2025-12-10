export class DomainError extends Error {
  status: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.status = options?.status ?? 400;
    this.code = options?.code;
  }
}
