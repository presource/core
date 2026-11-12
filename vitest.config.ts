import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
        passWithNoTests: true,
        // ---- Type-level suite: `types/**/*.test-d.ts` -------------------------------------------
        // Opt-in by design: `enabled` stays false so the default run (`vitest run --coverage`,
        // i.e. the `test` script) never shells out to tsc. Nothing about the runtime run changes:
        // no extra test entries (`*.test-d.ts` never matches the `include` pattern above, so the
        // runtime project never tries to *execute* them), no coverage delta (coverage only
        // instruments `src/**`, the type tests live in `types/`), and no tsc noise from
        // in-flight edits in src.
        // Run it explicitly with `vitest run --typecheck.only` (package script `test:types`).
        // `only: true` is only consulted while typechecking is enabled (vitest evaluates
        // `typecheck.enabled && typecheck.only`), so it makes the opt-in run typecheck-only:
        // the runtime `*.test.ts` files are not collected there and cannot be double-counted.
        typecheck: {
            checker: 'tsc',
            enabled: false,
            only: true,
            // Narrower than vitest's default (`**/*.{test,spec}-d.?(c|m)[jt]s?(x)`): only the
            // package's own `*.test-d.ts` files are treated as type tests.
            include: ['**/*.test-d.ts'],
            // `types/**` is outside `src/**`, which is the only thing packages/presource/core
            // tsconfig.json includes — without this program the tsc run would never see the
            // type tests and every assertion would pass vacuously.
            tsconfig: 'tsconfig.test-d.json',
            // Source-level type errors are owned by the package `typecheck` script
            // (`tsc --noEmit`); these tests assert inference of their own files only, so an
            // unrelated error in src must not turn the type-test run red.
            ignoreSourceErrors: true,
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/index.ts', 'src/index.ts'],
            reportsDirectory: 'coverage'
        }
    }
});
