/**
 * JSON fragment completion utility.
 *
 * Takes a partially-typed JSON string and attempts to complete it into
 * valid JSON by closing unclosed strings, removing trailing commas,
 * adding default values for bare keys, and closing unclosed brackets/braces.
 *
 * ## State tracking
 *
 * The function scans character-by-character, maintaining:
 * - `inString` / `escaped` — whether we are inside a JSON string and handling backslash escapes.
 * - `stack` — a stack of open enclosure characters (`{` or `[`), used to close them in reverse.
 * - `nextStringIsValue` — set `true` after `:` or inside an array, `false` after `{` or `,` in object context.
 * - `keyWithoutValue` — set `true` when a closing `"` is encountered while `nextStringIsValue` is `false`
 *   and the current nesting level is an object (top of stack is `{`). This means the string was a bare
 *   key with no `:` or value following it (e.g. `{"name"`).
 *
 * ## Completion rules (applied in order)
 *
 * 1. If the scanner finishes inside an unclosed string, append `"`.
 * 2. If the last completed token was a bare key (no colon/value), append `:""`.
 * 3. If the result ends with a trailing comma, remove it.
 * 4. Close any remaining open enclosures in reverse order (innermost first).
 *
 * If the original string is already valid JSON it is parsed and returned directly.
 * If completion is impossible (e.g. empty input), `undefined` is returned.
 *
 * @param jsonString - A potentially incomplete JSON fragment.
 * @returns The parsed JavaScript value, or `undefined` if completion fails.
 */
export const jsonComplete = (jsonString: string): any => {
    // Fast path: if the input is already valid JSON, parse and return it
    try {
        return JSON.parse(jsonString);
    } catch {
        // Not valid JSON — attempt completion below
    }

    // Empty string cannot be completed into valid JSON
    if (jsonString.length === 0) {
        return undefined;
    }

    // --- Phase 1: scan the input to determine what is unclosed ---

    let inString = false;
    let escaped = false;

    // Stack of open enclosure characters: '{' or '['
    // Used to append the correct closing characters in reverse order.
    const stack: string[] = [];

    // After ':' or inside an array, the next string token is a value (not a key).
    // After '{' or ',' in object context, the next string token is a key.
    let nextStringIsValue = false;

    // Set to true when a closing '"' is seen while nextStringIsValue is false
    // and the current nesting level is an object. Indicates a bare key like {"name".
    let keyWithoutValue = false;

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];

        // Previous character was a backslash inside a string — skip this char
        if (escaped) {
            escaped = false;
            continue;
        }

        // Backslash inside a string starts an escape sequence
        if (char === '\\' && inString) {
            escaped = true;
            continue;
        }

        // Toggle string state on unescaped double-quote
        if (char === '"') {
            if (inString) {
                // Closing quote
                inString = false;

                // If this string was a key in an object (not a value), mark it
                if (!nextStringIsValue && stack.length > 0 && stack[stack.length - 1] === '{') {
                    keyWithoutValue = true;
                } else {
                    keyWithoutValue = false;
                }
            } else {
                // Opening quote
                inString = true;
            }
            continue;
        }

        // --- Structural characters (only meaningful outside strings) ---
        if (!inString) {
            if (char === ':') {
                // After colon, the next token is a value
                nextStringIsValue = true;
                keyWithoutValue = false;
                continue;
            }

            if (char === '{') {
                stack.push(char);
                // In an object, we expect a key next
                nextStringIsValue = false;
                continue;
            }

            if (char === '[') {
                stack.push(char);
                // In an array, we expect a value next
                nextStringIsValue = true;
                continue;
            }

            if (char === '}' || char === ']') {
                stack.pop();
                // After closing an enclosure, the next token depends on context
                // (handled by subsequent structural chars like ',' or ':' or end-of-input)
                continue;
            }

            if (char === ',') {
                // Comma determines what's expected next based on the enclosing context
                if (stack.length > 0 && stack[stack.length - 1] === '{') {
                    // Comma in object → next is a key
                    nextStringIsValue = false;
                } else {
                    // Comma in array → next is a value
                    nextStringIsValue = true;
                }
                continue;
            }
        }
    }

    // --- Phase 2: build the completed string by appending missing tokens ---

    let completed = jsonString;

    // Rule 1: close any unclosed string
    if (inString) {
        completed += '"';
    }

    // Rule 2: bare key with no colon/value — add :""  (e.g. {"name" → {"name":""})
    if (!inString && keyWithoutValue) {
        completed += ':""';
    }

    // Rule 3: remove trailing comma (invalid in JSON)
    if (completed.endsWith(',')) {
        completed = completed.slice(0, -1);
    }

    // Rule 4: close remaining open enclosures innermost-first
    while (stack.length > 0) {
        const open = stack.pop()!;
        completed += open === '{' ? '}' : ']';
    }

    // --- Phase 3: parse the completed JSON ---
    try {
        return JSON.parse(completed);
    } catch {
        return undefined;
    }
};
