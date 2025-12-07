export class LogBuffer {
  private buffer: string[] = [];
  private readonly maxLines: number;

  constructor(maxLines: number = 1000) {
    this.maxLines = maxLines;
  }

  append(line: string): void {
    this.buffer.push(line);
    if (this.buffer.length > this.maxLines) {
      this.buffer.shift();
    }
  }

  getLines(): string[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}
