import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

function isResponseEnvelope(value: unknown): value is { data: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'data' in value
  );
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      map((value: unknown) => {
        if (
          response.statusCode === HttpStatus.NO_CONTENT ||
          value === undefined ||
          isResponseEnvelope(value)
        ) {
          return value;
        }

        return { data: value };
      }),
    );
  }
}
