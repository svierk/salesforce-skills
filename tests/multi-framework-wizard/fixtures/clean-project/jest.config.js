const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
  ...jestConfig,
  moduleNameMapper: {
    '^lightning/uiEmbedding$': '<rootDir>/jest-mocks/lightning/uiEmbedding/uiEmbedding'
  }
};
