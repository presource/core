/**
 * For-loop abstractions (synchronous and asynchronous).
 *
 * Provides count-driven iteration helpers.  Each iteration receives a
 * rich argument object containing the current index, total length,
 * iteration count, and prior result.
 */




/**
 * Argument object passed to the callback on every iteration.
 *
 * @property callback - The callback function.
 * @property index - Current iteration index.
 * @property length - Total number of iterations to perform.
 * @property count - Zero-based iteration counter.
 * @property result - The return value from the previous callback invocation.
 */
type Argument = {
  callback: Callback;
  index: number;
  length: number;
  count: number;
  result: any;
};

/**
 * Function invoked each iteration of a for loop.
 *
 * @param args - The current iteration arguments (including shorthand aliases).
 * @returns The iteration result.  Returning a non-`undefined` value
 *          signals success and immediately breaks the loop.
 */
type Callback = (args: Argument) => any;

/**
 * Shared signature for the (synchronous) for-loop builder: accepts a
 * target length, a callback, and an optional start index.
 *
 * @param length - Total number of iterations.
 * @param callback - Function to execute each iteration.
 * @param start - Optional starting index (defaults to `0`).
 * @returns The final result value after the loop completes.
 */
type Structure = (
  length: number,
  callback: Callback,
  start?: number,
) => any;

/**
 * Internal helper that builds the argument object.
 *
 * @param length - Total number of iterations.
 * @param callback - Function to execute each iteration.
 * @param start - Starting index (defaults to `0`).
 * @returns The constructed argument object.
 */
const getParams: Structure = (length, callback, start = 0) => {
  // Setting up the Arguments
  const args = {
    // Index
    index: start,
    // The Callback Function
    callback,
    // Length
    length,
    // Counter
    count: 0,
    result: undefined,
  };

  return args;
};

/**
 * Synchronous for-loop: iterate a fixed number of times.
 *
 * Builds an argument record and invokes
 * *callback* on each pass.  The loop stops early if the callback
 * returns a non-`undefined` value (treated as a final success result).
 *
 * @param length - Total number of iterations.
 * @param callback - Function to execute each iteration.
 * @param start - Optional starting index (defaults to `0`).
 * @returns The final value of `record.result` after the loop ends.
 */
export const loopFor: Structure = (length, callback, start = 0) => {
  const record = getParams(length, callback, start);
  while (record.index < record.length) {
    record.result = callback(record);
    if (record.result !== undefined) break;
    record.index++;
    record.count++;
  }
  return record.result;
};

/**
 * Signature for the async for-loop builder: same parameters as
 * {@link Structure} but returns a `Promise`.
 *
 * @param length - Total number of iterations.
 * @param callback - Async function to execute each iteration.
 * @param start - Optional starting index (defaults to `0`).
 * @returns A promise that resolves to the final result value.
 */
type StructureAsync = (
  length: number,
  callback: Callback,
  start?: number,
) => Promise<any>;

/**
 * Asynchronous for-loop: iterate a fixed number of times, awaiting
 * the callback each pass.
 *
 * Identical semantics to {@link loopFor} but uses `for`/`await` so the
 * callback can be an async function.  A non-`undefined` return value
 * breaks the loop early.
 *
 * @param length - Total number of iterations.
 * @param callback - Async function to execute each iteration.
 * @param start - Optional starting index (defaults to `0`).
 * @returns A promise that resolves to the final result value.
 */
export const loopForAsync: StructureAsync = async (length, callback, start = 0) => {
  const record = getParams(length, callback, start);
  for (; record.index < record.length; record.index++) {
    record.result = await callback(record);
    if (record.result !== undefined) break;
    record.count++;
  }
  return record.result;
};
