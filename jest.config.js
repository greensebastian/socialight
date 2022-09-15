const { pathsToModuleNameMapper } = require('ts-jest');
const tsconfig = require('tsconfig');
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
// const { compilerOptionsWithComments } = require('./tsconfig');

const compilerOptions = tsconfig.readFileSync('tsconfig.json');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  verbose: true,
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.compilerOptions.paths, { prefix: '<rootDir>/' }),
};
