import { installConsoleTimestamps } from "./utils/consoleTimestamps";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// v4.179.0: time-stamp every console line (HH:MM:SS.mmm local).
installConsoleTimestamps();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
