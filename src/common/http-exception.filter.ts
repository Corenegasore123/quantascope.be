import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { AppError } from "./app-error";
import { ZodError } from "zod";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      return res.status(exception.status).json({ error: exception.message, code: exception.code });
    }
    if (exception instanceof ZodError) {
      return res.status(400).json({
        error: exception.issues[0]?.message ?? "Invalid request",
        code: "VALIDATION_ERROR",
      });
    }
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : (payload as { message?: string | string[] }).message;
      return res.status(exception.getStatus()).json({
        error: Array.isArray(message) ? message[0] : message ?? exception.message,
        code: "HTTP_ERROR",
      });
    }

    console.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: "Internal server error",
      code: "INTERNAL",
    });
  }
}
