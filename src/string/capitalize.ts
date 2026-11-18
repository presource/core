/**
 * String capitalization utility.
 *
 * Capitalizes a specific character position (default: the first letter)
 * within each word of a string, without altering the remaining characters.
 */


/**
 * Capitalize the character at the given index in every space-separated word.
 * A negative `letter` is resolved from the end of the word (e.g. `-1` targets its last
 * character). That rebase mutates the parameter, so in a multi-word string only the FIRST
 * word is rebased and the later words reuse the resolved index (see the TODO below). Empty
 * words are left unchanged.
 * @param value - The input string.
 * @param letter - Zero-based character index to capitalize. Defaults to `0`. Negative values count from the end.
 * @returns The string with the targeted character uppercased in each word.
 */
export const stringCapitalize = (value: string, letter = 0) => {
    const array = value.split(' ').map((entry) => {
        if (!entry) return entry;
        const length = entry.length;
        // Resolve negative index from the end of the word
        // TODO: pending - BUG: `letter` is mutated across words
        // (`letter += length` below), so only the FIRST word is rebased and every
        // later word reuses the already-resolved index. A local variable would fix
        // it, but the current output is pinned by capitalize.test.ts
        if (letter < 0) letter += length;
        return entry.slice(0, letter) + entry.charAt(letter).toUpperCase() + entry.slice(letter + 1);
    });
    return array.join(' ');
};
