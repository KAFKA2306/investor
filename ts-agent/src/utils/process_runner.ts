/**
 * 外部プロセスを安全にしゅばばばっと実行するよっ！⚙️⚡
 * @param command 実行するコマンド
 * @param args 引数の配列
 * @returns プロセスの終了コード
 */
export async function runProcess(
  command: string,
  args: string[],
): Promise<number> {
  const proc = Bun.spawn([command, ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}

/**
 * プロセスの標準出力を文字列として取得するよっ！📖
 */
export async function runProcessWithOutput(
  command: string,
  args: string[],
  maxChars = 100 * 1024 * 1024,
): Promise<string> {
  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (stdout.length > maxChars) {
    throw new Error(`command output exceeds limit: ${command}`);
  }

  if (exitCode !== 0) {
    throw new Error(
      `command failed: ${command} ${args.join(" ")} :: ${stderr.slice(0, 800)}`,
    );
  }

  return stdout;
}

/**
 * 指定した時間だけ、おやすみなさい（待機）するよっ！💤
 */
export async function wait(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * プロセス実行の司令官、processRunnerだよっ！🎀✨
 */
export const processRunner = {
  run: runProcess,
  runWithOutput: runProcessWithOutput,
  wait,
};
