#!/bin/bash
set -e

echo "Building autogoals/devbox Docker image..."

cd "$(dirname "$0")"

docker build -t autogoals/devbox:latest .

echo "✓ Image built successfully"
echo "Run: docker images | grep autogoals"
