module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "overrides": [
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "rules": {
        "curly": ["error", "all"],
        "semi": ["error", "always"],
        "quotes": ["error", "double"],
        "guard-for-in": ["error", "all"],
        "no-else-return": ["error", "all"],
        "no-extra-parens ": ["error", "always"],
        "multiline-comment-style": ["error", "starred-block"],
        "prefer-const": ["error", {
            "destructuring": "any",
            "ignoreReadBeforeAssign": false
        }],
        "no-unused-vars": ["error", { "vars": "all", "args": "after-used", "ignoreRestSiblings": false }],
    }
};
