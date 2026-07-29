import { spawn } from "node:child_process";

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputTruncated: boolean;
}

export async function runProcess(input: {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.executable, input.args, {
      cwd: input.cwd,
      shell: false,
      env: {
        PATH: process.env.PATH,
        CI: "true",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let outputTruncated = false;
    let timedOut = false;

    function append(
      current: Buffer<ArrayBufferLike>,
      chunk: Buffer<ArrayBufferLike>,
    ): Buffer<ArrayBufferLike> {
      const remaining = input.maxOutputBytes - current.length;
      if (remaining <= 0) {
        outputTruncated = true;
        return current;
      }
      if (chunk.length > remaining) {
        outputTruncated = true;
      }
      return Buffer.concat([current, chunk.subarray(0, Math.max(0, remaining))]);
    }

    child.stdout.on("data", (chunk: Buffer<ArrayBufferLike>) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer<ArrayBufferLike>) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", reject);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 500).unref();
    }, input.timeoutMs);

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        timedOut,
        outputTruncated,
      });
    });
  });
}
