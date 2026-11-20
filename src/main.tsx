import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";
import { rum } from "./lib/rumBridge";
import { syncSessionFromUrl } from "./lib/session";
import { loadThirdParties } from "./lib/vendors";

syncSessionFromUrl();
rum.mark("app:boot");

// Vendors load after the app shell, async, so they never block rendering.
if (document.readyState === "complete") loadThirdParties();
else window.addEventListener("load", loadThirdParties, { once: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
