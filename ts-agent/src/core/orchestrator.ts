export class Orchestrator {
  private readonly agentCount = 16;

  public async runParallel(task: () => Promise<void>) {
    console.log(`Launching ${this.agentCount} parallel agents... ✨`);

    const agents = Array.from({ length: this.agentCount }, (_, i) =>
      this.spawnAgent(i, task),
    );
    await Promise.all(agents);

    console.log("All parallel missions accomplished! ✨");
  }

  private async spawnAgent(id: number, task: () => Promise<void>) {
    console.log(`Agent ${id} is starting mission... ✨`);
    await task();
    console.log(`Agent ${id} completed mission! ✨`);
  }
}
