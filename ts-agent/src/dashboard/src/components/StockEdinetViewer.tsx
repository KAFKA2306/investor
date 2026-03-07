import type React from "react";
import { useEffect, useState } from "react";
import {
  EdinetProvider,
  isAnnualReport,
  isEarningsReport,
} from "../../../providers/edinet_provider";
import type { EdinetDocument } from "../../../schemas/financial_domain_schemas";
import {
  type EdinetKeyInsights,
  extractKeyInsightsFromEdinetContent,
} from "../utils/edinet_extractor";
import "../styles/stock_edinet_viewer.css";

interface Stock {
  symbol: string;
  name?: string;
  position?: number;
  return?: number;
}

interface StockEdinetViewerProps {
  stocks: Stock[];
  selectedStock?: string;
  onSelectStock?: (symbol: string) => void;
}

interface StockWithInsights extends Stock {
  edinetInsights?: EdinetKeyInsights;
  latestDisclosureDate?: string;
}

export const StockEdinetViewer: React.FC<StockEdinetViewerProps> = ({
  stocks,
  selectedStock: initialSelected,
  onSelectStock,
}) => {
  const [selectedStock, setSelectedStock] = useState<string | undefined>(
    initialSelected || stocks[0]?.symbol,
  );
  const [stocksWithInsights, setStocksWithInsights] =
    useState<StockWithInsights[]>(stocks);
  const [loading, setLoading] = useState(false);

  // EDINET データ取得・抽出
  useEffect(() => {
    const fetchEdinetData = async () => {
      setLoading(true);
      try {
        const provider = new EdinetProvider();
        const updatedStocks: StockWithInsights[] = [];

        for (const stock of stocks) {
          // 銘柄コード → SEC コードのマッピング
          // 実際には、プロジェクト内の参照データや J-Quants API で
          // 銘柄コード → SEC コードを取得する必要があります
          // ここでは例として J-Quants 銘柄コードを直接 SEC コードとして使用
          const secCode = stock.symbol; // TODO: 適切なマッピング処理に置き換える

          try {
            // 該当 SEC コードの開示一覧を取得（今日は例として昨日までの分を取得）
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const dateStr = yesterday.toISOString().slice(0, 10);
            const documents = await provider.getDocumentsBySecCode(
              dateStr,
              secCode,
            );

            // 最新の年報または決算報告を取得
            const latestDoc = documents
              .filter(
                (doc: EdinetDocument) =>
                  isAnnualReport(doc) || isEarningsReport(doc),
              )
              .sort((a: EdinetDocument, b: EdinetDocument) => {
                const timeA = a.submitDateTime
                  ? new Date(a.submitDateTime).getTime()
                  : 0;
                const timeB = b.submitDateTime
                  ? new Date(b.submitDateTime).getTime()
                  : 0;
                return timeB - timeA;
              })[0];

            if (latestDoc) {
              // 開示書類をダウンロード・抽出
              const content = await provider.downloadDocument(latestDoc.docID);
              if (content) {
                const insights = extractKeyInsightsFromEdinetContent(content);

                updatedStocks.push({
                  ...stock,
                  edinetInsights: insights,
                  latestDisclosureDate: latestDoc.submitDateTime
                    ? new Date(latestDoc.submitDateTime).toLocaleDateString(
                        "ja-JP",
                      )
                    : "不明",
                });
              } else {
                updatedStocks.push(stock);
              }
            } else {
              // 開示データがない場合
              updatedStocks.push(stock);
            }
          } catch (error) {
            console.warn(
              `Failed to fetch EDINET data for ${stock.symbol}:`,
              error,
            );
            updatedStocks.push(stock);
          }
        }

        setStocksWithInsights(updatedStocks);
      } catch (error) {
        console.error("Failed to initialize EDINET provider:", error);
        setStocksWithInsights(stocks);
      } finally {
        setLoading(false);
      }
    };

    fetchEdinetData();
  }, [stocks]);

  const current = stocksWithInsights.find((s) => s.symbol === selectedStock);

  const handleSelectStock = (symbol: string) => {
    setSelectedStock(symbol);
    onSelectStock?.(symbol);
  };

  return (
    <div className="stock-edinet-viewer">
      {/* Stock List Panel */}
      <div className="stocks-panel">
        <h3 className="panel-title">アルファ選定銘柄 📈</h3>
        <div className="stocks-list">
          {stocksWithInsights.length === 0 ? (
            <p className="empty-message">銘柄データがありません</p>
          ) : (
            stocksWithInsights.map((stock) => (
              <button
                type="button"
                key={stock.symbol}
                className={`stock-item ${selectedStock === stock.symbol ? "selected" : ""}`}
                onClick={() => handleSelectStock(stock.symbol)}
              >
                <div className="stock-symbol">{stock.symbol}</div>
                <div className="stock-info">
                  <div className="stock-name">{stock.name || stock.symbol}</div>
                  {stock.position !== undefined && (
                    <div className="stock-position">
                      Position: {(stock.position * 100).toFixed(2)}%
                    </div>
                  )}
                  {stock.return !== undefined && (
                    <div
                      className={`stock-return ${stock.return >= 0 ? "positive" : "negative"}`}
                    >
                      {(stock.return * 100).toFixed(2)}%
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* EDINET Disclosure Panel */}
      <div className="disclosure-panel">
        {current ? (
          <>
            <div className="disclosure-header">
              <h2>{current.symbol}</h2>
              {current.latestDisclosureDate && (
                <p className="disclosure-date">
                  開示日: {current.latestDisclosureDate}
                </p>
              )}
            </div>

            {current.edinetInsights ? (
              <div className="disclosure-content">
                {/* Company Overview */}
                {current.edinetInsights.companyOverview && (
                  <section className="disclosure-section">
                    <h4>企業概要</h4>
                    <p className="section-content">
                      {current.edinetInsights.companyOverview}
                    </p>
                  </section>
                )}

                {/* Financial Metrics */}
                {current.edinetInsights.financialMetrics.length > 0 && (
                  <section className="disclosure-section">
                    <h4>主要財務指標</h4>
                    <ul className="metrics-list">
                      {current.edinetInsights.financialMetrics.map(
                        (metric, _idx) => (
                          <li key={metric} className="metric-item">
                            {metric}
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                )}

                {/* Main Products */}
                {current.edinetInsights.mainProducts.length > 0 && (
                  <section className="disclosure-section">
                    <h4>主要製品・サービス</h4>
                    <ul className="products-list">
                      {current.edinetInsights.mainProducts.map(
                        (product, _idx) => (
                          <li key={product} className="product-item">
                            {product}
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                )}

                {/* Risks and Challenges */}
                {current.edinetInsights.risksAndChallenges.length > 0 && (
                  <section className="disclosure-section risks">
                    <h4>⚠️ リスク・課題</h4>
                    <ul className="risks-list">
                      {current.edinetInsights.risksAndChallenges.map(
                        (risk, _idx) => (
                          <li key={risk} className="risk-item">
                            {risk}
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                )}
              </div>
            ) : loading ? (
              <div className="loading-state">
                <p>EDINET 開示情報を取得中...</p>
                <div className="spinner" />
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-disclosure">
            <p>銘柄を選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
};
