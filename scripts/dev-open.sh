#!/bin/bash

# Build a11ycap
echo "Building a11ycap..."
pnpm --filter a11ycap build

# Start the dev server in background
echo "Starting test page server on port 14652..."
cd testpagecra
PORT=14652 BROWSER=none pnpm start &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
while ! curl -s http://localhost:14652 > /dev/null; do
  sleep 1
done

# Open browser
echo "Opening browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  open http://localhost:14652
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  xdg-open http://localhost:14652
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  # Windows
  start http://localhost:14652
fi

# Keep the script running
echo "Test page is running at http://localhost:14652"
echo "Press Ctrl+C to stop the server"
wait $SERVER_PID