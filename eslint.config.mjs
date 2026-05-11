// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";

export default tseslint.config(
    {
        ignores: ["dist", "node_modules", "*.config.js"],
    },
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            vitest,
        },
        extends: [
            js.configs.recommended,
            vitest.configs.recommended,
            ...tseslint.configs.recommended,
        ],
        rules: {
            "no-console": "warn",
            "vitest/no-disabled-tests": "error",
            "@typescript-eslint/no-unused-expressions": [
                "error",
                {
                    "allowShortCircuit": true,
                    "allowTernary": true
                }
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-unsafe-function-type": "off"
        },
    },
    {
        files: ["**/*.test.{js,ts}"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...vitest.environments.env.globals,
            },
        },
    }
);
