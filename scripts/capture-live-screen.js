import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(
  "C:/Users/soulwax/.gemini/antigravity/brain/25a1bdf0-4d27-4897-8bda-20f27c1c8021"
);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function capturePage({ targetUrl, targetHeading, outputFilename }) {
  const outputFile = path.join(outputDir, outputFilename);
  console.log(`\nCapturing '${targetHeading || "Page Top"}' from ${targetUrl}...`);

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "--window-size=1600,2200",
    `--user-data-dir=${path.join(process.env.TEMP || "C:\\Temp", "chrome_cdp_" + Date.now())}`,
    targetUrl,
  ]);

  let pageWsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch("http://127.0.0.1:9222/json/list");
      const list = await res.json();
      const page = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) {
        pageWsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!pageWsUrl) {
    chrome.kill();
    throw new Error("Could not find open page target in Chrome CDP list");
  }

  const ws = new WebSocket(pageWsUrl);
  let msgId = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  await send("Page.enable");
  await send("Runtime.enable");

  // Wait for initial network & fonts
  await sleep(3500);
  await send("Runtime.evaluate", {
    expression: "document.fonts.ready",
    awaitPromise: true,
  });

  if (targetHeading) {
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const headings = Array.from(document.querySelectorAll('h3, h4, h2'));
          const target = headings.find(h => h.textContent.includes('${targetHeading}'));
          if (target) {
            target.scrollIntoView({ block: 'start', behavior: 'instant' });
          }
        })()
      `,
    });
    await sleep(800);
  }

  const screenshotRes = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });

  if (screenshotRes && screenshotRes.data) {
    const buffer = Buffer.from(screenshotRes.data, "base64");
    fs.writeFileSync(outputFile, buffer);
    console.log(`Saved screenshot: ${outputFile} (${buffer.length} bytes)`);
  }

  ws.close();
  chrome.kill();
  await sleep(500);
}

// Standalone execution: capture section 1 and section 8
if (process.argv[1]?.endsWith("capture-live-screen.js")) {
  (async () => {
    try {
      await capturePage({
        targetUrl: "https://mel.bluesix.dev/engine-mathematics#",
        targetHeading: "1. Fixed-Step 60 Hz Kinematics",
        outputFilename: "math_section1_rendered_live.png",
      });
      await capturePage({
        targetUrl: "https://mel.bluesix.dev/engine-mathematics#",
        targetHeading: "Diurnal Celestial Mechanics",
        outputFilename: "math_section8_rendered_live.png",
      });
      console.log("\nAll live verification screenshots captured successfully.");
      process.exit(0);
    } catch (err) {
      console.error("Capture failure:", err);
      process.exit(1);
    }
  })();
}
