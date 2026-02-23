import { MarketdataLocalGateway } from "./src/gateways/marketdata_local_gateway.ts";

async function debugEstat() {
    const gateway = await MarketdataLocalGateway.create(["1375"]);
    const estatObj = (await gateway.getEstatStats("0000010101")) as Record<string, any>;
    console.log(JSON.stringify(estatObj.GET_STATS_DATA, null, 2).slice(0, 2000));
}

debugEstat();
