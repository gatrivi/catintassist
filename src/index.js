import { installConsoleTimestamps } from "./utils/consoleTimestamps";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { applyAudioSourceFromUrl } from "./utils/audioSourceManager";

// v4.179.0: time-stamp every console line (HH:MM:SS.mmm local).
installConsoleTimestamps();
// v4.184.0: `?cable` / `?tab` in the URL picks the audio source before first render.
applyAudioSourceFromUrl();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
