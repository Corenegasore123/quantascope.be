export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "APP_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}
