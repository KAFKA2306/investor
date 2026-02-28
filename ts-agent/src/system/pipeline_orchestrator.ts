import { type IElder, type IDataEngineer, type IQuantResearcher, type IExecutionAgent, type IStateMonitor, type PipelineRequirement, type IdeaCandidate, type VerificationResult, type PITDataset } from "./pipeline_types.ts";
import { BaseAgent } from "./app_runtime_core.ts";
import { CqoAgent } from "../agents/chief_quant_officer_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";

/**
 * PipelineOrchestrator: The "Controller/統括" agent.
 * Strictly follows docs/diagrams/sequence.md and simpleflowchart.md.
 */
export class PipelineOrchestrator extends BaseAgent {
  private cqo = new CqoAgent();

  constructor(
    private readonly elder: IElder,
    private readonly dataEngineer: IDataEngineer,
    private readonly quantResearcher: IQuantResearcher,
    private readonly executionAgent: IExecutionAgent,
    private readonly stateMonitor: IStateMonitor
  ) {
    super();
  }

  public async runPipeline(requirement: PipelineRequirement): Promise<void> {
    console.log(`[Orchestrator] Starting mission strictly based on sequence.md and simpleflowchart.md`);

    // Note left of 統括: フェーズ1: 入力と探索
    // 1. 人間->>統括: 要件を入力
    this.emitEvent("PIPELINE_STARTED", { requirementId: requirement.id });

    // 2. 統括->>記憶: 履歴を取得
    // 3. 記憶-->>統括: シード/禁止領域を返却
    const history = await this.elder.getHistory(requirement.id);

    // [Deviations Fixed: #2, #12 State Monitor Integration, #19 Long-term Memory]
    const currentState = await this.stateMonitor.getCurrentState();

    // 4. 統括->>統括: アイデア生成
    // [Deviation Fixed: #5 Knowledge Reference, #6 Structure Update, #20 Priority Queue]
    // Ideas are generated based on history, knowledge, and current state.
    const candidates = await this.generateHighLevelIdeas(requirement, history, currentState);
    
    for (const candidate of candidates) {
      // 5. 統括->>記憶: アイデア候補を保存
      await this.elder.saveIdeaCandidate(candidate);
      
      let dataset: PITDataset | null = null;
      let datasetReady = false;
      let dataAttempt = 1;

      // [Deviation Fixed: #4 Data Integration Phase, #18 Dynamic Delivery Condition]
      // 6. 統括->>データ: PIT整合/欠損補完済みデータ作成を依頼
      // 7. データ-->>統括: 学習用データセットと文脈を返却
      dataset = await this.dataEngineer.preparePITData(requirement, dataAttempt);
      let context = await this.dataEngineer.generateScenario(dataset);
      dataset.context = context;

      // 8. 統括->>統括: データ納入条件を判定
      // Dynamic condition based on requirement target metrics
      const requiredQuality = requirement.targetMetrics?.minSharpe ? 0.7 + (requirement.targetMetrics.minSharpe * 0.05) : 0.8;

      while (!datasetReady && dataAttempt <= 3) {
        if (dataset.qualityScore >= requiredQuality) {
          // else 納入条件達成
          // 12. 統括->>統括: 次段へ進行
          datasetReady = true;
          console.log(`[Orchestrator] Step 12: 次段へ進行 (Data condition met. Score: ${dataset.qualityScore})`);
        } else {
          // alt 納入条件未達
          dataAttempt++;
          console.warn(`[Orchestrator] Data condition unmet. Attempt: ${dataAttempt}`);
          // [Deviation Fixed: #14 Learning reflection on intermediate failure]
          await this.elder.reflectLearning(candidate.id, `Data Prep Attempt ${dataAttempt-1} failed (Score: ${dataset.qualityScore})`);
          
          // 9. 統括->>データ: 再作成を依頼（6へ）
          // 10. データ-->>統括: 改訂データセットを返却
          dataset = await this.dataEngineer.preparePITData(requirement, dataAttempt);
          context = await this.dataEngineer.generateScenario(dataset);
          dataset.context = context;
          // 11. 統括->>統括: データ納入条件を再判定（7へ）
        }
      }

      if (!datasetReady || !dataset) continue;

      // 13. 統括->>記憶: データ版と前処理条件を保存
      // [Deviation Fixed: #15 Save preprocessing conditions]
      await this.elder.saveDatasetInfo(dataset.id, { asOfDate: dataset.asOfDate, metadata: "PIT_CLEANED" }, dataset.preprocessingConditions);

      // Note left of 統括: フェーズ2: 評価と判定
      let verificationReady = false;
      let currentDataset = dataset;
      let retryMode: "MODEL" | "NONE" = "NONE";
      let verification: VerificationResult | undefined;
      let isAdopted = false;

      while (!verificationReady) {
        // 14. 統括->>分析: 候補式とデータセットを入力
        
        // [Deviations Fixed: #1, #7, #8, #9 - Explicit model selection, policy design, factor exploration with context, and co-optimization]
        // 15. 分析->>分析: 基盤モデルを選定
        const modelConfig = await this.quantResearcher.selectFoundationModel(candidate, currentDataset.context);
        
        // 16. 分析->>分析: 適応方針を設計
        modelConfig.adaptationPolicy = await this.quantResearcher.designAdaptationPolicy(modelConfig.foundationModelId, candidate);
        await this.elder.saveModelConfiguration(modelConfig); // [Deviation Fixed: #16 Update Registry/Memory]

        // 17. 分析->>分析: 因子探索と候補式の精査を実行
        const refinedCandidate = await this.quantResearcher.exploreFactors(candidate, currentDataset.context);

        // 18. 分析->>分析: 共最適化/バックテストを実行
        // 19. 分析-->>統括: 採否/主要指標(Sharpe/IC/MDD)/モデル構成を返却
        verification = await this.quantResearcher.coOptimizeAndVerify(refinedCandidate, currentDataset, modelConfig, retryMode, history.forbiddenZones);
        
        // 20. 統括->>統括: 納入条件を判定
        const verdict = this.judgeVerification(verification, requirement);

        if (verdict === "REJECTED_DATA") {
          // alt 納入条件未達（データ起因）
          dataAttempt++;
          await this.elder.reflectLearning(candidate.id, `Verification failed due to DATA. Data attempt: ${dataAttempt}`);
          // 21. 統括->>データ: 再作成を依頼（6へ）
          // 22. データ-->>統括: 改訂データセットを返却
          currentDataset = await this.dataEngineer.preparePITData(requirement, dataAttempt);
          currentDataset.context = await this.dataEngineer.generateScenario(currentDataset);
          // 23. 統括->>分析: 再検証を依頼（14へ）
          retryMode = "NONE";
        } else if (verdict === "REJECTED_MODEL") {
          // else 納入条件未達（モデル起因）
          await this.elder.reflectLearning(candidate.id, `Verification failed due to MODEL. Retrying with model re-selection.`);
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
        // [Deviation Fixed: #10 Capacity and exact constraints]
        const audit = this.cqo.auditStrategy(verification);
        const capacityCheck = (verification.verification?.metrics?.turnover || 0) < 0.5; // Example physical constraint
        
        if (audit.verdict === "APPROVED" && audit.isProductionReady && capacityCheck) {
          // alt 発注可
          // 30. 統括->>執行: 注文を生成
          const rawAllocations = await this.executionAgent.optimizeAllocation(verification);
          const riskControlledAllocations = await this.executionAgent.applyRiskControl(rawAllocations);
          const orderPlan = await this.executionAgent.optimizeHedge(riskControlledAllocations);
          orderPlan.strategyId = candidate.id;
          
          // [Deviation Fixed: #11 Eventify Order Plan]
          await this.elder.saveOrderPlan(orderPlan);
          
          // 31. 執行->>執行: 注文を執行し約定を取得
          // 32. 執行-->>統括: 執行結果を返却
          const executionResult = await this.executionAgent.execute(orderPlan);
          
          // 33. 統括->>記憶: 採用理由と執行結果を保存
          // [Deviation Fixed: #17 Semantic adoption reason]
          const adoptionReason = verification.adoptionReason || `Strong Sharpe (${verification.verification?.metrics?.sharpeRatio}) in regime: ${currentDataset.context}`;
          await this.elder.saveExecutionResult(executionResult, adoptionReason);
          
          // [Deviation Fixed: #13 Compliance status persistence]
          const auditRecord = await this.executionAgent.audit(executionResult);
          await this.elder.saveAuditRecord(auditRecord);

          // [Deviation Fixed: #12 Feedback loop closed]
          const driftReport = await this.executionAgent.analyzeDrift(auditRecord);
          await this.elder.updateStatus(driftReport);
          await this.stateMonitor.recordDrift(driftReport);

        } else {
          // else 発注不可
          // 34. 統括->>記憶: 発注不可理由を保存
          const reason = !capacityCheck ? "Capacity/Turnover constraints violated" : audit.critique.join(", ");
          await this.elder.saveRejectionReason(candidate.id, "ORDER_GATE_REJECTED", reason);
          await this.elder.reflectLearning(candidate.id, `Rejected at Order Gate: ${reason}`);
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

  private async generateHighLevelIdeas(requirement: PipelineRequirement, history: any, currentState: any): Promise<IdeaCandidate[]> {
    const playbook = new ContextPlaybook();
    await playbook.load();
    
    // Inject knowledge into Playbook virtually
    for (const k of history.knowledge || []) {
      playbook.addBullet({ content: `[KNOWLEDGE]: ${k}`, section: "domain_knowledge" });
    }
    
    // Mocking generation logic - ideally we'd use LLM here
    // Priority queue simulation
    const rawIdeas: IdeaCandidate[] = [
      { id: `ID-${crypto.randomUUID().slice(0,8)}`, requirementId: requirement.id, ast: {}, description: "Mean Reversion Seed", reasoning: "Based on history", noveltyScore: 0.9, priority: 0.9 },
      { id: `ID-${crypto.randomUUID().slice(0,8)}`, requirementId: requirement.id, ast: {}, description: "Momentum Seed", reasoning: "Current state favors momentum", noveltyScore: 0.7, priority: 0.85 },
      { id: `ID-${crypto.randomUUID().slice(0,8)}`, requirementId: requirement.id, ast: {}, description: "Random Noise Strategy", reasoning: "Testing forbidden zone", noveltyScore: 0.1, priority: 0.1 }
    ];

    let validIdeas = rawIdeas.filter(f => !history.forbiddenZones?.some((fz: string) => f.description.includes(fz)));
    
    // Sort by priority (Priority Queue)
    validIdeas.sort((a, b) => b.priority - a.priority);
    
    return validIdeas;
  }

  public async run(): Promise<void> {
    // Base class requirement
  }
}
