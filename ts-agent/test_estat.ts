import { EstatProvider } from "./src/providers/external_market_providers.ts";

async function check() {
    const estat = new EstatProvider();
    const res = await estat.getStats("0003435161") as any;
    console.log(JSON.stringify(res.GET_STATS_DATA.STATISTICAL_DATA.CLASS_INF, null, 2));
    console.log("---");
    const values = res.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE;
    console.log(JSON.stringify(values.slice(0, 5), null, 2));
}

check();
