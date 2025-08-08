module.exports = function jsxDebugSourcePlugin({ types: t }) {
  return {
    name: "jsx-debug-source",
    visitor: {
      JSXOpeningElement(path, state) {
        // Only add debug info in development
        if (process.env.NODE_ENV !== 'development') return;

        const elName = path.node.name?.name;
        const filename = state.file.opts.filename || '';
        const line = path.node.loc?.start?.line;

        // Skip if we don't have the necessary info
        if (!elName || !filename || !line) return;

        const makeAttr = (name, value) =>
          t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(String(value)));

        // Add debug attributes
        path.node.attributes.push(
          makeAttr('data-debug-id', elName),
          makeAttr('data-debug-source', `${filename}:${line}`)
        );
      }
    }
  };
};