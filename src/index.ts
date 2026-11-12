/**
 * Presource Core – main barrel export.
 *
 * Re-exports every utility submodule so that consumers can import
 * all helpers from a single entry point (`presource/core`).
 */
export * from './array';
export * from './boolean';
export * from './class';
export * from './conditions';
// './constants' was previously unexported (the folder held no values); the
// documented EMPTY_STRING / SPACE_STRING / ... sentinels are now reachable here.
export * from './constants';
export * from './data';
export * from './function';
export * from './is';
export * from './json';
export * from './loop';
// NOTE: './nexus' moved to the standalone '@presource/nexus' package
// (packages/presource/nexus) — it depends on this package, not the reverse.
export * from './number';
export * from './object';
export * from './promise';
export * from './script';
export * from './string';
export * from './task';
export * from './to';
export * from './type';
