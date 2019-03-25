module.exports = exports = {
  env: {
    es6: true
  },
  parserOptions: {
    sourceType: 'module'
  },
  parser: 'babel-eslint',
  extends: ['plugin:prettier/recommended'],
  rules: {
    'prettier/prettier': 'error'
  }
};