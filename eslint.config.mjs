import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended, // to remove
    //tseslint.configs.strict, // to add
    //tseslint.configs.stylistic, // to add
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }], //to remove
            '@typescript-eslint/explicit-function-return-type': 'off', // to remove
            '@typescript-eslint/explicit-module-boundary-types': 'off', // to remove
            '@typescript-eslint/no-explicit-any': 'off', // to remove
            '@typescript-eslint/no-wrapper-object-types': 'off', // to remove
            '@typescript-eslint/no-unsafe-function-type': 'off', // to remove
        },
    },
    {
        ignores: ['dist/**', 'src/common/open-api/**', 'docs/**', 'node_modules/**'],
    },
);