import { t } from '#lib/i18n';

/** The server answered with a non-2xx status. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** The request never completed: no signal, timeout, DNS or TLS failure. Safe to retry later. */
export class NetworkError extends Error {
  constructor(message = t('errors.network')) {
    super(message);
    this.name = 'NetworkError';
  }
}
