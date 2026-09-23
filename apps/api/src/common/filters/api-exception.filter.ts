import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

type ApiErrorDetail = { field: string; message: string };
type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  details?: ApiErrorDetail[];
};

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const ERROR_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Yêu cầu không hợp lệ.',
  [HttpStatus.UNAUTHORIZED]: 'Chưa xác thực.',
  [HttpStatus.FORBIDDEN]: 'Bạn không có quyền thực hiện thao tác này.',
  [HttpStatus.NOT_FOUND]: 'Không tìm thấy tài nguyên.',
  [HttpStatus.CONFLICT]: 'Dữ liệu đang xung đột.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Dữ liệu không thể xử lý.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Có quá nhiều yêu cầu. Vui lòng thử lại.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Dịch vụ tạm thời không khả dụng.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]*$/.test(value);
}

function isErrorDetails(value: unknown): value is ApiErrorDetail[] {
  return (
    Array.isArray(value) &&
    value.every(
      (detail) =>
        isRecord(detail) &&
        typeof detail.field === 'string' &&
        typeof detail.message === 'string',
    )
  );
}

function defaultErrorCode(statusCode: number): string {
  if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return statusCode === HttpStatus.SERVICE_UNAVAILABLE
      ? 'SERVICE_UNAVAILABLE'
      : 'INTERNAL_SERVER_ERROR';
  }

  return ERROR_CODES[statusCode] ?? 'HTTP_ERROR';
}

function defaultErrorMessage(statusCode: number): string {
  if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return 'Đã xảy ra lỗi hệ thống.';
  }

  return ERROR_MESSAGES[statusCode] ?? 'Không thể xử lý yêu cầu.';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException || isServerError) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error('Unhandled API exception', stack ?? String(exception));
    }

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : undefined;
    const responseObject = isRecord(exceptionResponse)
      ? exceptionResponse
      : undefined;
    const responseError = responseObject?.error;
    const customErrorCode = isErrorCode(responseError) ? responseError : null;
    const responseMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : responseObject?.message;

    const body: ApiErrorBody = {
      statusCode,
      error: isServerError
        ? defaultErrorCode(statusCode)
        : (customErrorCode ?? defaultErrorCode(statusCode)),
      message:
        isServerError || !customErrorCode || typeof responseMessage !== 'string'
          ? defaultErrorMessage(statusCode)
          : responseMessage,
    };

    if (
      !isServerError &&
      customErrorCode &&
      isErrorDetails(responseObject?.details)
    ) {
      body.details = responseObject.details;
    }

    response.status(statusCode).json(body);
  }
}
