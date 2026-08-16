import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { WorkflowEngine } from "../workflows/engine.service";

@Injectable()
export class SlaScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(@Inject(WorkflowEngine) private readonly engine: WorkflowEngine) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.engine.processSla().catch((err) => console.error("SLA job failed", err));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
