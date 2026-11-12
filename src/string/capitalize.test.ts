import { stringCapitalize } from './capitalize';

/**
 * Contract source: src/string/capitalize.ts (lines 19-29).
 *
 * Behaviour nailed down here:
 * - `value.split(' ')` means ONLY the ASCII space separates words: tabs and
 *   newlines stay inside a single "word".
 * - Empty words (consecutive / leading / trailing spaces) short-circuit at line 21.
 * - A negative `letter` is rebased ONCE (`letter += length`, line 25) and then
 *   mutates the shared parameter for every following word. Known upstream bug,
 *   tracked by the TODO at capitalize.ts:24 - tests pin the ACTUAL output.
 * - `charAt` returns '' for out-of-range indexes, so those words come back unchanged.
 */
describe('stringCapitalize', () => {
    test('it should capitalise first letter', () => {
        expect(stringCapitalize('capitalise')).toEqual('Capitalise');
    });

    test('it should capitalise second letter', () => {
        expect(stringCapitalize('apple', 1)).toEqual('aPple');
    });

    test('it should capitalise the last letter', () => {
        expect(stringCapitalize('banana', -1)).toEqual('bananA');
    });

    test('it should capitalise first letter of every word in a string', () => {
        const input = 'capitalise this string';
        const output = 'Capitalise This String';

        // Expectation
        expect(stringCapitalize(input)).toEqual(output);
    });

    test('it should handle empty entries from consecutive spaces', () => {
        // Consecutive spaces produce empty entries which should pass through unchanged
        expect(stringCapitalize('a  b')).toEqual('A  B');
        expect(stringCapitalize('  hello')).toEqual('  Hello');
        expect(stringCapitalize('hello  ')).toEqual('Hello  ');
    });

    test('explicit letter of 0 matches the default parameter', () => {
        // `letter = 0` is a default parameter (capitalize.ts:19), so passing 0 is identical
        expect(stringCapitalize('abc', 0)).toBe('Abc');
        expect(stringCapitalize('abc')).toBe('Abc');
        expect(stringCapitalize('ab cd ef')).toBe('Ab Cd Ef');
        expect(stringCapitalize('ab cd ef', 0)).toBe('Ab Cd Ef');
    });

    test('empty and whitespace-only strings are returned unchanged', () => {
        // '' splits into [''] which hits the `if (!entry)` guard at line 21
        expect(stringCapitalize('')).toBe('');
        // '   ' splits into four empty entries - every entry short-circuits
        expect(stringCapitalize('   ')).toBe('   ');
        expect(stringCapitalize(' ')).toBe(' ');
    });

    test('out-of-range positive index leaves every word unchanged', () => {
        // charAt(99) === '' and slice() clamps, so the word round-trips identically
        expect(stringCapitalize('hello world', 99)).toBe('hello world');
        expect(stringCapitalize('ab', 5)).toBe('ab');
        expect(stringCapitalize('a b c', 5)).toBe('a b c');
    });

    test('index beyond one word still applies inside a longer word', () => {
        // Index is NOT clamped per word: 'a' and 'bc' have no char at 2, 'def' does -> 'deF'
        expect(stringCapitalize('a bc def', 2)).toBe('a bc deF');
        // Same index applied to a single word produces the in-word hit
        expect(stringCapitalize('def', 2)).toBe('deF');
    });

    test('only the space character splits words - tab and newline do not', () => {
        // 'hi\tthere' is one word, so only its very first character is touched
        expect(stringCapitalize('hi\tthere')).toBe('Hi\tthere');
        expect(stringCapitalize('hi\nthere')).toBe('Hi\nthere');
        // Mixed separators behave the same way (single word until a real space)
        expect(stringCapitalize('a\tb c\nd')).toBe('A\tb C\nd');
    });

    test('already upper-case and non-alphabetic characters are preserved', () => {
        expect(stringCapitalize('HELLO world')).toBe('HELLO World');
        // '1'.toUpperCase() === '1' - digits are inert
        expect(stringCapitalize('123 abc')).toBe('123 Abc');
        // Punctuation at index 0 is unchanged, the following letters are untouched
        expect(stringCapitalize('!x.y z')).toBe('!x.y Z');
        expect(stringCapitalize('1abc', 1)).toBe('1Abc');
        expect(stringCapitalize('a1c', 1)).toBe('a1c');
    });

    test('negative index is rebased on the first word then reused for the rest', () => {
        // 'hello': -1 + 5 === 4 -> 'hellO'; 'world' then reuses the already-resolved 4 -> 'worlD'
        expect(stringCapitalize('hello world', -1)).toBe('hellO worlD');
        // 'hi': -1 + 2 === 1 -> 'hI'; 'there' then uses index 1 -> 'tHere' (capitalize.ts:24 bug)
        expect(stringCapitalize('hi there', -1)).toBe('hI tHere');
        // 'ab': -2 + 2 === 0 -> 'Ab'; every later word now targets index 0
        expect(stringCapitalize('ab cd ef', -2)).toBe('Ab Cd Ef');
        // All one-letter words rebase to 0 and stay at 0
        expect(stringCapitalize('a b c', -1)).toBe('A B C');
    });

    test('negative index on short words', () => {
        // Single-letter word: -1 + 1 === 0 -> the only character is uppercased
        expect(stringCapitalize('x', -1)).toBe('X');
        // 'xy' rebases to 1 -> 'xY'; 'z' then has no character at index 1 -> unchanged
        expect(stringCapitalize('xy z', -1)).toBe('xY z');
    });

    test('negative index larger than the word length clamps through slice', () => {
        // 'hello': -10 + 5 === -5 -> slice(0, -5) === '' + charAt(-5) === '' + slice(-4) === 'ello'
        // The mutated -5 is then reused for 'world': -5 + 5 === 0 -> 'World'
        expect(stringCapitalize('hello world', -10)).toBe('ello World');
    });

    test('unicode letters uppercase and astral pairs count as two code units', () => {
        expect(stringCapitalize('élan bico')).toBe('Élan Bico');
        // Default index 0 is the BMP 'a'; the astral pair is left intact
        expect(stringCapitalize('a😀b c')).toBe('A😀b C');
        // -1 resolves to code-unit index 3 (length is 4, not 3) which is the 'b'
        expect(stringCapitalize('a😀b c', -1)).toBe('a😀B c');
    });
});
