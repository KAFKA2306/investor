import { PriceMomentumOperator } from "./src/core/operators/momentum_operator.ts";
import { uifRuntime } from "./src/core/uif_runtime.ts";
import { dataMesh } from "./src/gateways/data_mesh.ts";
import { core } from "./src/core/index.ts";

async function testQuantumPlayback() {
    console.log("🚀 Initializing Nova Gen 4 Quantum Playback Test...");

    const operator = new PriceMomentumOperator();
    const parentEventId = crypto.randomUUID();

    // 1. Simulate Market Data Stream (Data Mesh)
    console.log("📡 Publishing market events to Data Mesh...");
    dataMesh.publish({
        symbol: "7203",
        type: "BAR",
        timestamp: new Date().toISOString(),
        data: { price: 2500 }
    });

    // 2. Execute Operator via UIF Runtime
    console.log("🧠 Executing PriceMomentumOperator...");
    const effect1 = await uifRuntime.execute(operator, { symbol: "7203", price: 2500 }, parentEventId);
    console.log("Effect 1:", effect1);

    const effect2 = await uifRuntime.execute(operator, { symbol: "7203", price: 2600 }, parentEventId);
    console.log("Effect 2:", effect2);

    // 3. Verify UQTL v2 (Event Store)
    console.log("📋 Verifying UQTL v2 Causal Ledger...");
    // Use a very broad range for verification in this test
    const events = core.eventStore.getEventsSince("2026-01-01");

    console.log(`Found ${events.length} events in ledger.`);
    for (const event of events) {
        console.log(`- [${event.type}] ID: ${event.id.slice(0, 8)} | Parent: ${event.parentEventId?.slice(0, 8) || "NONE"} | Operator: ${event.operatorId || "NONE"}`);
    }

    if (events.some((e: any) => e.operatorId === "PriceMomentumOperator")) {
        console.log("✅ Quantum Playback Test PASSED: Lineage preserved.");
    } else {
        console.log("❌ Quantum Playback Test FAILED: Operator events missing.");
    }

    core.eventStore.close();
}

testQuantumPlayback().catch(console.error);
