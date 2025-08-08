# @pwsnapshot/babel-plugin-jsx-debug-source

A Babel plugin that automatically adds debug source information to JSX elements as `data-*` attributes during development builds.

## What it does

Transforms this:
```jsx
<Button onClick={handleClick} />
```

Into this (development builds only):
```jsx
<Button onClick={handleClick} data-debug-id="Button" data-debug-source="/path/to/Component.tsx:15" />
```

## Installation

```bash
npm install --save-dev @pwsnapshot/babel-plugin-jsx-debug-source
```

## Usage

### With Create React App (using CRACO)

1. Install CRACO:
```bash
npm install --save-dev @craco/craco
```

2. Update your `package.json` scripts:
```json
{
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test"
  }
}
```

3. Create `craco.config.js`:
```js
module.exports = {
  babel: {
    plugins: ['@pwsnapshot/babel-plugin-jsx-debug-source']
  }
};
```

### With Vite

Add to your `vite.config.js`:
```js
export default {
  // ... other config
  esbuild: {
    // Vite uses esbuild, but for Babel plugins you need:
  },
  // Or use @vitejs/plugin-react-babel instead of @vitejs/plugin-react
}
```

### With Next.js

Add to your `next.config.js`:
```js
module.exports = {
  experimental: {
    swcPlugins: [
      // SWC version needed, or use Babel mode
    ]
  },
  // Or force Babel mode:
  babel: {
    plugins: ['@pwsnapshot/babel-plugin-jsx-debug-source']
  }
}
```

### With plain Babel

Add to your `.babelrc` or `babel.config.js`:
```json
{
  "plugins": ["@pwsnapshot/babel-plugin-jsx-debug-source"]
}
```

## Output

The plugin adds two data attributes to each JSX element:

- `data-debug-id`: The element name (e.g., `"Button"`, `"div"`)
- `data-debug-source`: The file path and line number (e.g., `"/src/Component.tsx:42"`)

## Use Cases

This plugin is particularly useful for:

- **Testing tools** that need to map DOM elements back to source code
- **Development debugging** to quickly find which component rendered an element
- **AI-powered development tools** that analyze React component structure
- **Browser extensions** that provide enhanced React developer experience

## Development Mode Only

The plugin only runs in development mode (`NODE_ENV=development`). Production builds are unaffected.

## License

MIT