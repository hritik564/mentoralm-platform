/** Shared with plain-Node startup and synthetic tests; no provider credentials involved. */
export function runtimeArguments(env, args = []) {
  const production = env.MENTORALM_ENV === 'production';
  const result = [...args];
  for (const flags of [
    ['--hostname', '-H'],
    ['--port', '-p'],
  ])
    if (result.filter((a) => flags.includes(a)).length > 1)
      throw Error('Duplicate runtime argument.');
  const hostFlag = result.findIndex((a) => a === '--hostname' || a === '-H');
  const portFlag = result.findIndex((a) => a === '--port' || a === '-p');
  if (production && hostFlag >= 0 && result[hostFlag + 1] !== '0.0.0.0')
    throw Error('Invalid bind.');
  if (result.some((a) => /^(?:--hostname|--port)=/.test(a)))
    throw Error('Use separate runtime arguments.');
  if (hostFlag < 0)
    result.push('--hostname', production ? '0.0.0.0' : '127.0.0.1');
  const port = portFlag >= 0 ? result[portFlag + 1] : env.PORT || '3000';
  if (!/^\d+$/.test(port || '') || Number(port) < 1 || Number(port) > 65535)
    throw Error('Invalid port.');
  if (production && portFlag >= 0 && env.PORT && port !== env.PORT)
    throw Error('Deployment port mismatch.');
  if (portFlag < 0) result.push('--port', port);
  return result;
}
