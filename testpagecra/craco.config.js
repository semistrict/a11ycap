module.exports = {
  babel: {
    plugins: ['babel-plugin-a11ycap']
  },
  webpack: {
    configure: (webpackConfig) => {
      // Ignore source map warnings for react-devtools-inline
      webpackConfig.ignoreWarnings = [
        function ignoreSourcemapWarnings(warning) {
          return warning.module &&
            warning.module.resource &&
            warning.module.resource.includes('react-devtools-inline') &&
            warning.message.includes('Failed to parse source map');
        }
      ];
      return webpackConfig;
    }
  }
};