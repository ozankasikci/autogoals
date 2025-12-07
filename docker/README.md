# AutoGoals DevBox Docker Image

Base development environment for AutoGoals containers.

## Contents

- Node.js 20
- Python 3
- Git
- Build tools (gcc, make, etc.)

## Building

```bash
cd docker
docker build -t autogoals/devbox:latest .
```

## Usage

Used automatically by AutoGoals when creating workspace containers.
