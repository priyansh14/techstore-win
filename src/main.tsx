import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { rum } from "./lib/rumBridge";
import { syncSessionFromUrl } from "./lib/session";

syncSessionFromUrl();
rum.mark("app:boot");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
