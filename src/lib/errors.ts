export class VirtualMinError extends Error {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly raw?: string,
  ) {
    super(message);
    this.name = "VirtualMinError";
  }
}
