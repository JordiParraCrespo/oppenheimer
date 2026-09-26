/**
 * DI tokens for the hosts module.
 *
 * The two application ports are published surface: `HOST_ASSERTION` is what the
 * auth layer's credential resolver asks to recognise a runner's boot assertion,
 * and `HOST_ACCESS` is what a module that wants to run something on a host
 * injects to check the caller may use it.
 */
export const HOST_REPOSITORY = Symbol('HOST_REPOSITORY');
export const HOST_PAIRING_TOKEN_REPOSITORY = Symbol('HOST_PAIRING_TOKEN_REPOSITORY');
export const HOST_ASSERTION = Symbol('HOST_ASSERTION');
export const HOST_ACCESS = Symbol('HOST_ACCESS');
export const HOST_PRESENCE = Symbol('HOST_PRESENCE');
export const HOST_KEY = Symbol('HOST_KEY');
export const HOST_METADATA_REPOSITORY = Symbol('HOST_METADATA_REPOSITORY');
export const IP_GEOLOCATION = Symbol('IP_GEOLOCATION');
