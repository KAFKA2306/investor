# Industry Sector Mapping: 33 Categories to 16

Objective: Standardize the complex 33-industry classification from the Securities Identification Code Committee into 16 optimized categories to improve model training efficiency and data balance.

---

## Executive Summary
This document provides the "Magic Recipe" for mapping the official 33 industry sectors into 16 broader categories. This mapping is used by the `edinet2dataset` tool to eliminate data sparsity and create robust industry prediction models.

---

## Magic Mapping Table (33 -> 16) 🪄

The following mapping is applied within the `edinet2dataset` pipeline to group Japanese industries into high-fidelity categories for AI analysis.

| Original 33 Industries | Standardized 16 Industries |
| :--- | :--- |
| Fishery, Agriculture & Forestry, Foods | Foods 🍱 |
| Mining, Oil & Coal Products, Electric Power & Gas | Energy & Utilities ⚡ |
| Construction, Metal Products, Glass & Ceramics | Construction & Materials 🏗️ |
| Textiles & Apparels, Pulp & Paper, Chemicals | Materials & Chemicals 🧪 |
| Pharmaceutical | Pharmaceuticals 💊 |
| Rubber Products, Transportation Equipment | Automotive & Transportation 🚗 |
| Iron & Steel, Nonferrous Metals | Steel & Nonferrous 🔩 |
| Machinery | Machinery ⚙️ |
| Electric Appliances, Precision Instruments | Electronics & Precision 💻 |
| Other Products, Info & Comm, Services | IT, Services & Others 🌐 |
| Land Transportation, Marine Transportation, Air Transportation, Warehousing | Logistics & Transport 🚢 |
| Wholesale Trade | Trading & Wholesale 📦 |
| Retail Trade | Retail 🛒 |
| Banks | Banking 🏦 |
| Securities & Commodities, Insurance, Other Financials | Financials (Excl. Banks) 💳 |
| Real Estate | Real Estate 🏠 |

---

## Implementation Details
By applying this mapping, the system ensures that the dataset used for industry prediction tasks is balanced and representative, enabling the AI to learn sector-specific features without being overwhelmed by excessive granularity. ✨
