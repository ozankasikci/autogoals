const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  start(message: string): void;
  update(message: string): void;
  stop(): void;
  succeed(message: string): void;
  fail(message: string): void;
}

export function createSpinner(): Spinner {
  let timer: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let currentMessage = "";

  function render(): void {
    const frame = FRAMES[frameIndex % FRAMES.length];
    process.stderr.write(`\r\x1b[K${frame} ${currentMessage}`);
    frameIndex++;
  }

  function clearLine(): void {
    process.stderr.write("\r\x1b[K");
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start(message: string): void {
      if (timer !== null) {
        // Already running — just update the message
        currentMessage = message;
        return;
      }
      currentMessage = message;
      frameIndex = 0;
      render();
      timer = setInterval(render, 80);
    },

    update(message: string): void {
      currentMessage = message;
    },

    stop(): void {
      if (timer === null) return;
      stopTimer();
      clearLine();
    },

    succeed(message: string): void {
      stopTimer();
      clearLine();
      process.stderr.write(`✓ ${message}\n`);
    },

    fail(message: string): void {
      stopTimer();
      clearLine();
      process.stderr.write(`✗ ${message}\n`);
    },
  };
}
