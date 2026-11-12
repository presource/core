/**
 * String constants.
 *
 * Single-source literal strings used across the library so call sites never
 * hand-type empty/sentinel strings (which are easy to mistype and hard to grep).
 *
 * Documented in `knowledge.md` ("Constants") and consumed by repo scripts
 * (`scripts/clean-temp.ts`, `scripts/sync-versions.ts`) via
 * `import { EMPTY_STRING } from '@presource/core'`.
 */

/** The empty string — canonical "no value" string. */
export const EMPTY_STRING = '';

/** A single space character — canonical join/split separator. */
export const SPACE_STRING = ' ';

/** Digits 0-9 in order — used for numeric lookups / shuffles. */
export const NUMBERS_STRING = '0123456789';

/** Lowercase a-z in order — used for alphabetic lookups / shuffles. */
export const ALPHABET_STRING = 'abcdefghijklmnopqrstuvwxyz';

/** The literal text "null" — matches `toString(null)` / `typeName` sentinel output. */
export const NULL_STRING = 'null';

/** The literal text "undefined" — matches `toString(undefined)` sentinel output. */
export const UNDEFINED_STRING = 'undefined';
