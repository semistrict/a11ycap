# Publishing to npm

This monorepo contains three publishable packages:
- `a11ycap` - Core accessibility snapshot library
- `a11ycap-mcp` - MCP server for web agent integration  
- `babel-plugin-a11ycap` - Babel plugin for enhanced debug information

## Prerequisites

1. Ensure you're logged into npm:
```bash
npm login
```

2. Verify your npm account:
```bash
npm whoami
```

## Publishing Process

### 1. Build and Test

First, ensure everything builds and tests pass:
```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint check
pnpm lint
```

### 2. Version Bump

Update versions in each package you want to publish. Since this is a monorepo with workspace dependencies, you'll need to coordinate versions:

```bash
# In a11ycap/
cd a11ycap
npm version patch  # or minor/major

# In a11ycap-mcp/ (if it depends on a11ycap, update its dependency version too)
cd ../a11ycap-mcp
npm version patch
# Also update the a11ycap dependency version in package.json if needed

# In babel-plugin-a11ycap/
cd ../babel-plugin-a11ycap  
npm version patch
```

### 3. Publish Packages

Publish in dependency order:

```bash
# 1. Publish core library first
cd a11ycap
npm publish

# 2. Then publish MCP server (depends on a11ycap)
cd ../a11ycap-mcp
npm publish

# 3. Finally publish babel plugin (independent)
cd ../babel-plugin-a11ycap
npm publish
```

### 4. Git Tag and Push

After successful publishing:
```bash
# Go back to root
cd ..

# Commit version changes
git add -A
git commit -m "chore: release packages"

# Tag the release
git tag -a v1.0.0 -m "Release v1.0.0"

# Push changes and tags
git push origin main --tags
```

## First-Time Publishing

For the first publish, you may want to use a beta tag to test:

```bash
# Publish with beta tag
npm publish --tag beta

# Users can install with:
# npm install a11ycap@beta
```

Once verified, publish the stable version:
```bash
npm publish
```

## Troubleshooting

- **401 Unauthorized**: Run `npm login` to authenticate
- **403 Forbidden**: Package name may be taken or you lack permissions
- **Build errors**: Ensure `pnpm build` succeeds before publishing
- **Workspace dependencies**: The MCP server uses `workspace:*` for a11ycap dependency. This will be automatically resolved to the current version during publish.

## Notes

- All packages are configured with `"access": "public"` for public npm registry
- The `prepare` script ensures packages are built before publishing
- testpagecra is marked private and won't be published