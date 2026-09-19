export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');
export const PROJECT_LOOKUP = Symbol('PROJECT_LOOKUP');
/**
 * Where the module that owns sessions registers its answer to "is this project
 * still in use". Nothing registered means archiving refuses, which is the
 * fail-closed this module cannot provide for itself.
 */
export const PROJECT_USAGE_REGISTRAR = Symbol('PROJECT_USAGE_REGISTRAR');
