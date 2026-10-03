import type { Instrumentation } from 'next';
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('./lib/production/config');
    const { verifyBuildConfiguration } =
      await import('./lib/production/build-config');
    const { log } = await import('./lib/production/logging');
    try {
      validateEnvironment();
      verifyBuildConfiguration();
      log('info', 'startup', { code: 'CONFIG_VALID' });
    } catch (error) {
      log('error', 'configuration_invalid', { code: 'CONFIG_INVALID' });
      throw error;
    }
  }
}
export const onRequestError: Instrumentation.onRequestError = async (
  _error,
  request,
) => {
  const { log } = await import('./lib/production/logging');
  const id = request.headers['x-mentoralm-request-id'];
  log('error', 'request_error', {
    requestId: typeof id === 'string' ? id : undefined,
    route: request.path,
    code: 'SERVER_ERROR',
  });
};
