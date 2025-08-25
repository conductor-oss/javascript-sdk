import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ['**/*.{js,ts}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                ...globals.browser,
                NodeJS: 'readonly',
                RequestInit: 'readonly',
                RequestInfo: 'readonly',
                HeadersInit: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'error',
            'no-unused-vars': 'off',
        },
    },
    {
        ignores: ['dist/**', 'src/common/open-api/**', 'docs/**', 'node_modules/**'],
    },
];
