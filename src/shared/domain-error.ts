// โยนจาก domain เมื่อผิดกฎธุรกิจ code ต้องตรงกับ Error.code ใน openapi.yaml
export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'DomainError';
  }
}
