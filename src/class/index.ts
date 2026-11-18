/**
 * Class utilities barrel.
 *
 * Re-exports `classConstructor` (constructor lookup) and `classCreate` (dynamic class
 * factory). The `ClassConstructor` / `ClassCreate` signature types stay file-local:
 * they are declared without `export`, so they are not part of the public surface
 * (docs/issues/0011, P2).
 */
export * from './constructor';
export * from './create';
