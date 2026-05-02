import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		files: ['src/app.d.ts'],
		rules: { '@typescript-eslint/no-empty-object-type': 'off' }
	},
	{ ignores: ['build/', '.svelte-kit/', 'dist/', '.wrangler/', 'node_modules/'] }
);
