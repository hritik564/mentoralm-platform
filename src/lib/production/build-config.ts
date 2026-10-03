import { publicConfigurationHash } from './public-config.mjs';
export { publicConfigurationHash };
export function verifyBuildConfiguration() {
  const built = process.env.MENTORALM_BUILD_PUBLIC_CONFIG_HASH;
  if (built && built !== publicConfigurationHash(process.env))
    throw Error(
      'Public configuration differs from the build. Rebuild required.',
    );
}
