import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyDevStatsSeed } from "./utils/devStatsSeed";
import "./index.css";

// Localhost-only: hardcode today's call history into stats before load.
applyDevStatsSeed();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
