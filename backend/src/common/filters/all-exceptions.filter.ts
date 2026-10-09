import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  /** Injecte les dépendances : HttpAdapterHost. */
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  /** Intercepte toute exception et répond avec un JSON uniforme (statusCode, message, timestamp, path) ; les erreurs non HTTP deviennent une 500 générique. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
          };

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] }).message ??
          'Internal server error');

    // Champs métier ajoutés par l'exception (ex. code, reason, endTime d'un ban) : conservés pour le client.
    const extra: Record<string, unknown> = {
      ...(typeof exceptionResponse === 'object' ? exceptionResponse : {}),
    };
    delete extra.statusCode;
    delete extra.message;
    delete extra.error;

    // Code stable lu par le client pour traduire l'erreur dans la langue de l'utilisateur : celui de l'exception, sinon un code générique (validation des DTO ou statut HTTP).
    const code =
      typeof extra.code === 'string'
        ? extra.code
        : Array.isArray(message) && Number(status) === 400
          ? 'VALIDATION_FAILED'
          : `HTTP_${status}`;

    httpAdapter.reply(
      ctx.getResponse(),
      {
        ...extra,
        code,
        statusCode: status,
        message: message,
        timestamp: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        path: httpAdapter.getRequestUrl(ctx.getRequest()),
      },
      status,
    );
  }
}
