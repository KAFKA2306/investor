import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./style.css";
import "./professional-overrides.css";
import "./accessibility-overrides.css";
import "./kafka-signal.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

document.documentElement.dataset.kafkaSignal = "kafka-signal-v1.0.0";
const releaseMeta = document.createElement("meta");
releaseMeta.name = "kafka-signal-release";
releaseMeta.content = "kafka-signal-v1.0.0";
document.head.append(releaseMeta);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
