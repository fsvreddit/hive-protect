import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin"

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        files: ["**/*.test.ts"],
        plugins: {
            vitest
        },
        rules: {
            ...vitest.configs.recommended.rules,
            'vitest/valid-title': 'warn',
            'vitest/no-commented-out-tests': 'warn'
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx", "eslint.config.mjs"],

        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },

        rules: {
            // Extra rules
            "eqeqeq": ["error", "always", {
                null: "ignore",
            }],

            // Rules I don't want
            "@typescript-eslint/restrict-template-expressions": "off",

            // Extra code styling rules
            "comma-spacing": "error",
            "eol-last": "error",
            "key-spacing": "error",
            "keyword-spacing": "error",
            "new-parens": "error",
            "no-multi-spaces": "error",
            "no-sequences": "error",
            "no-trailing-spaces": "error",
            "no-whitespace-before-property": "error",
            "space-infix-ops": "error",
            "array-bracket-newline": ["error", "consistent"],
            "array-bracket-spacing": ["error", "never"],
            "array-element-newline": ["error", "consistent"],
            "arrow-body-style": ["error", "as-needed"],
            "arrow-parens": ["error", "as-needed"],
            "func-call-spacing": ["error", "never"],

            "func-style": ["error", "declaration", {
                allowArrowFunctions: true,
            }],

            "function-paren-newline": ["error", "multiline"],
            "implicit-arrow-linebreak": ["error", "beside"],

            "indent": ["error", 4, {
                VariableDeclarator: "first",
                SwitchCase: 1,
            }],

            "no-extra-parens": ["error", "all", {
                conditionalAssign: false,
                ignoreJSX: "multi-line",
            }],

            "no-multiple-empty-lines": ["error", {
                max: 1,
            }],

            "arrow-spacing": ["error", {
                before: true,
                after: true,
            }],

            "block-spacing": ["error", "always"],
            "brace-style": ["error", "1tbs"],
            "comma-dangle": ["error", "always-multiline"],
            "comma-style": ["error", "last"],
            "computed-property-spacing": ["error", "never"],
            "curly": ["error", "all"],
            "dot-location": ["error", "property"],

            "object-curly-newline": ["error", {
                multiline: true,
                consistent: true,
            }],

            "object-curly-spacing": ["error", "never"],

            "object-property-newline": ["error", {
                allowAllPropertiesOnSameLine: true,
            }],

            "object-shorthand": ["error", "always"],
            "operator-assignment": ["error", "always"],
            "padded-blocks": ["error", "never"],
            "quote-props": ["error", "consistent-as-needed"],

            "quotes": ["error", "double", {
                avoidEscape: true,
            }],

            "semi": ["error", "always"],

            "semi-spacing": ["error", {
                before: false,
                after: true,
            }],

            "semi-style": ["error", "last"],
            "space-before-blocks": ["error", "always"],
            "space-before-function-paren": ["error", "always"],
            "space-in-parens": ["error", "never"],

            "space-unary-ops": ["error", {
                words: true,
                nonwords: false,
            }],

            "spaced-comment": ["error", "always"],

            "switch-colon-spacing": ["error", {
                before: false,
                after: true,
            }],

            "template-curly-spacing": ["error", "never"],
            "template-tag-spacing": ["error", "never"],
            "wrap-iife": ["error", "inside"],

            "camelcase": ["error", {
                properties: "always",
            }],
        },
    },
    {
        ignores: ["**/node_modules", "**/dist", "eslint.config.mjs", "**/difflib"],
    },
    {
        plugins: vitest
    }
);
