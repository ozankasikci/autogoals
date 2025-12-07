FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    build-essential \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set up working directory
WORKDIR /workspace

# Keep container alive
CMD ["tail", "-f", "/dev/null"]
