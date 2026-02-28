import { type IElder, type IDataEngineer, type IQuantResearcher, type IExecutionAgent, type PipelineRequirement, type IdeaCandidate, type VerificationResult } from "./pipeline_types.ts";
import { BaseAgent } from "./app_runtime_core.ts";
import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { CqoAgent } from "../agents/chief_quant_officer_agent.ts";
import { StrategicReasonerAgent } from "../agents/alpha_r1_reasoner_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";

/**
 * PipelineOrchestrator: The "Controller/統括" agent.
 * Follows the sequence diagram in docs/diagrams/sequence.md.
 */
export class PipelineOrchestrator extends BaseAgent {
  private les = new LesAgent();
  private cqo = new CqoAgent();
  private reasoner = new StrategicReasonerAgent();

  constructor(
    private readonly elder: IElder,
    private readonly dataEngineer: IDataEngineer,
    private readonly quantResearcher: IQuantResearcher,
    private readonly executionAgent: IExecutionAgent
  ) {
    super();
  }

  public async runPipeline(requirement: PipelineRequirement): Promise<void> {
    console.log(`[Orchestrator] Starting mission based on sequence.md`);

    // Note left of 統括: フェーズ1: 入力と探索
    // 1. 人間->>統括: 要件を入力
    this.emitEvent("PIPELINE_STARTED", { requirementId: requirement.id });

    // 2. 統括->>記憶: 履歴を取得
    // 3. 記憶-->>統括: シード/禁止領域を返却
    const history = await this.elder.getHistory(requirement.id);

    // 4. 統括->>統括: アイデア生成
    const candidates = await this.brainstorm(requirement, history);
    
    for (const candidate of candidates) {
      // 5. 統括->>記憶: アイデア候補を保存
      await this.elder.saveIdeaCandidate(candidate);
      
      let dataset: any;
      let datasetReady = false;
      let dataAttempt = 1;

      // 6. 統括->>データ: PIT整合/欠損補完済みデータ作成を依頼
      // 7. データ-->>統括: 学習用データセットと文脈を返却
      dataset = await this.dataEngineer.preparePITData(requirement, dataAttempt);
      dataset.context = await this.dataEngineer.generateScenario(dataset);

      // 8. 統括->>統括: データ納入条件を判定
      while (!datasetReady && dataAttempt <= 3) {
        if (dataset.qualityScore >= 0.8) {
          // else 納入条件達成
          // 12. 統括->>統括: 次段へ進行
          datasetReady = true;
          console.log(`[Orchestrator] Step 12: 次段へ進行 (Data condition met)`);
        } else {
          // alt 納入条件未達
          dataAttempt++;
          console.warn(`[Orchestrator] Data condition unmet. Attempt: ${dataAttempt}`);
          // 9. 統括->>データ: 再作成を依頼（6へ）
          // 10. データ-->>統括: 改訂データセットを返却
          dataset = await this.dataEngineer.preparePITData(requirement, dataAttempt);
          dataset.context = await this.dataEngineer.generateScenario(dataset);
          // 11. 統括->>統括: データ納入条件を再判定（7へ）
        }
      }

      if (!datasetReady) continue;

      // 13. 統括->>記憶: データ版と前処理条件を保存
      await this.elder.saveDatasetInfo(dataset.id, { asOfDate: dataset.asOfDate, metadata: "PIT_CLEANED", context: dataset.context });

      // Note left of 統括: フェーズ2: 評価と判定
      let verificationReady = false;
      let currentDataset = dataset;
      let retryMode: "MODEL" | "NONE" = "NONE";
      let verification: VerificationResult | undefined;
      let isAdopted = false;

      while (!verificationReady) {
        // 14. 統括->>分析: 候補式とデータセットを入力
        // (15. 分析->>分析: 基盤モデルを選定)
        // (16. 分析->>分析: 適応方針を設計)
        // (17. 分析->>分析: 因子探索と候補式の精査を実行)
        // (18. 分析->>分析: 共最適化/バックテストを実行)
        // 19. 分析-->>統括: 採否/主要指標(Sharpe/IC/MDD)/モデル構成を返却
        verification = await this.quantResearcher.research(candidate, currentDataset, retryMode, history.forbiddenZones);
        
        // 20. 統括->>統括: 納入条件を判定
        const verdict = this.judgeVerification(verification, requirement);

        if (verdict === "REJECTED_DATA") {
          // alt 納入条件未達（データ起因）
          dataAttempt++;
          // 21. 統括->>データ: 再作成を依頼（6へ）
          // 22. データ-->>統括: 改訂データセットを返却
          currentDataset = await this.dataEngineer.preparePITData(requirement, dataAttempt);
          currentDataset.context = await this.dataEngineer.generateScenario(currentDataset);
          // 23. 統括->>分析: 再検証を依頼（14へ）
          retryMode = "NONE";
        } else if (verdict === "REJECTED_MODEL") {
          // else 納入条件未達（モデル起因）
          // 24. 統括->>分析: 再選定を依頼
          // 25. 分析-->>統括: 改訂モデル構成を返却
          // 26. 統括->>分析: 再検証を依頼（14へ）
          retryMode = "MODEL";
        } else if (verdict === "ADOPTED") {
          // else 納入条件達成
          // 27. 統括->>統括: 次段へ進行
          verificationReady = true;
          isAdopted = true;
        } else {
           verificationReady = true;
           isAdopted = false;
        }
      }

      // Note right of 統括: 最終判定
      if (verification && isAdopted) {
        // 28. 統括->>記憶: 検証結果とモデル構成を保存
        await this.elder.saveVerificationResult(verification);

        // alt 採用
        // 29. 統括->>統括: 発注可否を最終確認（制約/期限/容量）
        const audit = this.cqo.auditStrategy(verification);
        
        if (audit.verdict === "APPROVED" && audit.isProductionReady) {
          // alt 発注可
          // 30. 統括->>執行: 注文を生成
          const rawAllocations = await this.executionAgent.optimizeAllocation(verification);
          const riskControlledAllocations = await this.executionAgent.applyRiskControl(rawAllocations);
          const orderPlan = await this.executionAgent.optimizeHedge(riskControlledAllocations);
          orderPlan.strategyId = candidate.id;
          
          await this.elder.saveOrderPlan(orderPlan);
          
          // 31. 執行->>執行: 注文を執行し約定を取得
          // 32. 執行-->>統括: 執行結果を返却
          const executionResult = await this.executionAgent.execute(orderPlan);
          
          // 33. 統括->>記憶: 採用理由と執行結果を保存
          await this.elder.saveExecutionResult(executionResult);
          
          const auditRecord = await this.executionAgent.audit(executionResult);
          const driftReport = await this.executionAgent.analyzeDrift(auditRecord);
          await this.elder.updateStatus(driftReport);

        } else {
          // else 発注不可
          // 34. 統括->>記憶: 発注不可理由を保存
          await this.elder.saveRejectionReason(candidate.id, "ORDER_GATE_REJECTED", audit.critique);
          await this.elder.reflectLearning(candidate.id, `Rejected at Order Gate: ${audit.critique.join(", ")}`);
        }
      } else {
        // else 棄却
        // 35. 統括->>記憶: 棄却理由と主要指標を保存
        await this.elder.saveRejectionReason(candidate.id, "REJECTED_GENERIC", verification?.verification?.metrics);
        await this.elder.reflectLearning(candidate.id, "Failed general validation criteria.");
      }
    }

    this.emitEvent("PIPELINE_COMPLETED", { requirementId: requirement.id });
  }

  private judgeVerification(v: VerificationResult, req: PipelineRequirement): "ADOPTED" | "REJECTED_DATA" | "REJECTED_MODEL" | "REJECTED_GENERAL" {
    if (v.failureType === "DATA") return "REJECTED_DATA";
    if (v.failureType === "MODEL") return "REJECTED_MODEL";
    
    const metrics = v.verification?.metrics;
    if (!metrics) return "REJECTED_GENERAL";

    const target = req.targetMetrics || { minSharpe: 1.5 };
    if ((metrics.sharpeRatio ?? 0) < (target.minSharpe ?? 1.5)) return "REJECTED_GENERAL";
    
    return "ADOPTED";
  }

  private async brainstorm(requirement: PipelineRequirement, history: any): Promise<IdeaCandidate[]> {
    const playbook = new ContextPlaybook();
    await playbook.load();
    
    // Inject knowledge into Playbook virtually for LesAgent
    for (const k of history.knowledge || []) {
      playbook.addBullet({ content: `[KNOWLEDGE]: ${k}`, section: "domain_knowledge" });
    }
    
    // Use LesAgent to generate factors
    let factors = await this.les.generateAlphaFactors(playbook.getBullets(), { count: 5 });
    
    // Filter out forbidden zones
    factors = factors.filter(f => !history.forbiddenZones?.some((fz: string) => f.description.includes(fz)));
    
    // Take top 3
    factors = factors.slice(0, 3);
    
    // Map to IdeaCandidate
    return factors.map(f => ({
      ...f,
      requirementId: requirement.id,
      noveltyScore: 0.8, // Default for new generation
      priority: 0.75
    }));
  }

  public async run(): Promise<void> {
    // Base class requirement
  }
}
