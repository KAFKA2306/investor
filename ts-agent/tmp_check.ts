import { EdinetProvider } from "./src/providers/edinet_provider.ts";

async function check() {
    const edinet = new EdinetProvider();
    const res = await edinet.getDocumentList("2020-06-29", 2);
    console.log(JSON.stringify(res.results.slice(0, 10).map(r => ({ secCode: r.secCode, docTypeCode: r.docTypeCode })), null, 2));
}
check();
