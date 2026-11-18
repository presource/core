/**
 * Type guard utilities module.
 *
 * Barrel over the type-checking predicates (`isBoolean` / `isNumber` / `isString` /
 * `isObject` / `isPromise` / `isFunction` ...), the nullish checks (`isValid` /
 * `isInvalid`) and the recursive emptiness checks (`isEmpty` / `isEmptyArray` /
 * `isEmptyObject`).
 */
export * from './boolean';
export * from './empty';
export * from './function';
export * from './invalid';
export * from './number';
export * from './object';
export * from './promise';
export * from './string';
export * from './valid';
