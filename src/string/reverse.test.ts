import { stringReverse } from './reverse';

/**
 * Contract source: src/string/reverse.ts (line 14) - `value.split('').reverse().join('')`.
 *
 * `String.prototype.split('')` splits by UTF-16 CODE UNIT, not by grapheme or code
 * point, so astral characters (emoji, RTL marks, etc.) have their surrogate pair
 * swapped and come back as two lone surrogates.
 */
describe('stringReverse', () => {
    test('should reverse a simple string', () => {
        expect(stringReverse('hello')).toBe('olleh');
    });

    test('should reverse a string with spaces', () => {
        expect(stringReverse('hello world')).toBe('dlrow olleh');
    });

    test('should return an empty string when given an empty string', () => {
        expect(stringReverse('')).toBe('');
    });

    test('should return the same string for a single character', () => {
        expect(stringReverse('a')).toBe('a');
    });

    test('should correctly reverse a palindrome', () => {
        expect(stringReverse('racecar')).toBe('racecar');
    });

    test('should handle numbers and symbols', () => {
        expect(stringReverse('abc123')).toBe('321cba');
        expect(stringReverse('a1!b2?')).toBe('?2b!1a');
    });

    test('should reverse a multi-line string by code unit', () => {
        expect(stringReverse('a\nb')).toBe('b\na');
        // CRLF becomes LF-CR because the two characters are swapped independently
        expect(stringReverse('a\r\nb')).toBe('b\n\ra');
    });

    test('should split astral surrogate pairs (code unit reversal)', () => {
        // 'a😀b' is ['a', U+1F600, 'b'] written as 4 UTF-16 code units: a, D83D, DE00, 62
        const emoji = 'a\ud83d\ude00b';
        // Reversed it is 'b' + lone low surrogate + lone high surrogate + 'a'
        expect(stringReverse(emoji)).toBe('b\ude00\ud83Da');
        // A bare emoji becomes the low surrogate first, then the high surrogate
        expect(stringReverse('\ud83d\ude00')).toBe('\ude00\ud83d');
        // Code-unit count is preserved even though the pair is broken
        expect(stringReverse(emoji).length).toBe(4);
        expect(Array.from(stringReverse(emoji)).map((char) => char.codePointAt(0))).toStrictEqual([
            0x62, 0xde00, 0xd83d, 0x61,
        ]);
    });

    test('should reverse RTL text by code unit order', () => {
        // م ر ح ب ا -> ا ب ح ر م (each Arabic letter is one BMP code unit)
        expect(stringReverse('\u0645\u0631\u062d\u0628\u0627')).toBe('\u0627\u0628\u062d\u0631\u0645');
    });

    test('should separate a combining mark from its base character', () => {
        // 'e' + U+0301 becomes the combining mark first, so the visible glyph changes
        expect(stringReverse('e\u0301')).toBe('\u0301e');
        // The precomposed U+00E9 is a single code unit and therefore survives untouched
        expect(stringReverse('\u00e9')).toBe('\u00e9');
    });

    test('should not mutate or reuse the input string', () => {
        const input = 'hello';

        expect(stringReverse(input)).toBe('olleh');
        // Strings are immutable and split() returns a fresh array, so `input` is intact
        expect(input).toBe('hello');
        expect(stringReverse(input)).toBe('olleh');
    });

    test('should be its own inverse', () => {
        expect(stringReverse(stringReverse('hello world'))).toBe('hello world');
        // Code-unit reversal is loss-free: reversing twice restores the surrogate pair too
        expect(stringReverse(stringReverse('a😀b'))).toBe('a😀b');
    });
});
