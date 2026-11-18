/**
 * Object utility module.
 *
 * Barrel file that re-exports every object-related utility from this package.
 * `./constant` is the one module not re-exported here: `ObjectConstant` is a type-only
 * export, so it never reaches the runtime surface (asserted by the object barrel tests),
 * and each consumer imports it directly from `./constant`.
 */
export * from './alias';
export * from './create';
export * from './each';
export * from './ensures';
export * from './extract';
export * from './fill';
export * from './filter';
export * from './flatten';
export * from './has';
export * from './map';
export * from './merge';
export * from './observe';
export * from './populate';
export * from './proxy';
export * from './registry';
export * from './resolve';
export * from './scan';
export * from './shuffle';
export * from './switch';
export * from './transform';
export * from './trigger';
export * from './unflatten';
export * from './update';
