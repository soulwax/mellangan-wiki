import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// Paths
const workspaceRoot = path.resolve(__dirname, "../../../");
const workspaceTodoPath = path.resolve(workspaceRoot, "TODO.md");
const notesBridgeDir = path.resolve(__dirname, "../notes-bridge");
const notesTodoPath = path.resolve(notesBridgeDir, "TODO.md");
const notesNotesPath = path.resolve(notesBridgeDir, "NOTES.md");

// Connected SSE clients
const sseClients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Watch files for changes
function setupWatchers() {
  const watchFile = (filePath, sourceName) => {
    if (!fs.existsSync(filePath)) return;
    let debounceTimer = null;
    fs.watch(filePath, (eventType) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`[Bridge] ${sourceName} changed (${eventType}) -> broadcasting SSE`);
        broadcast("todo-change", {
          source: sourceName,
          timestamp: Date.now(),
          todos: parseAllTodos(),
        });
      }, 120);
    });
  };

  watchFile(workspaceTodoPath, "workspace");
  watchFile(notesTodoPath, "notes-repo");
}

// Parse workspace TODO.md
function parseWorkspaceTodos() {
  if (!fs.existsSync(workspaceTodoPath)) return [];
  const text = fs.readFileSync(workspaceTodoPath, "utf8");
  const lines = text.split(/\r?\n/);
  const tasks = [];
  let currentTask = null;
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const match = line.match(/^-\s*\[([ x~!\?])\]\s*(.*)$/);
    if (match) {
      if (currentTask) tasks.push(currentTask);
      taskIndex++;
      const marker = match[1];
      const rest = match[2].trim();

      // Extract bold title e.g. **Title**
      const titleMatch = rest.match(/\*\*(.*?)\*\*/);
      const title = titleMatch ? titleMatch[1].replace(/\.$/, "") : rest.slice(0, 60);

      // Extract target file in backticks
      const fileMatch = rest.match(/`([^`]+\.(?:cpp|hpp|c|h|slang|py|txt|json|ini))`/) || rest.match(/`([^`]+)`/);
      const targetFile = fileMatch ? fileMatch[1] : "";

      // Extract Done when
      const doneMatch = rest.match(/Done when\s+(.*?)(?:\.|$)/i);
      const acceptance = doneMatch ? `Done when ${doneMatch[1]}.` : "";

      currentTask = {
        id: `ws_task_${taskIndex}`,
        source: "workspace",
        completed: marker.toLowerCase() === "x",
        marker,
        title,
        file: targetFile,
        raw: line,
        body: rest,
        acceptance,
        lane: "Build",
        category: "Gameplay",
        priority: "High",
        owner: targetFile.includes("gui") ? "gui/meta" : targetFile.includes("test") ? "test/vendor" : "core",
        lineNumber: i + 1,
      };
    } else if (currentTask && line.trim().length > 0 && !line.startsWith("#")) {
      currentTask.body += " " + line.trim();
    }
  }
  if (currentTask) tasks.push(currentTask);
  return tasks;
}

// Parse notes-bridge/TODO.md
function parseNotesTodos() {
  if (!fs.existsSync(notesTodoPath)) return [];
  const text = fs.readFileSync(notesTodoPath, "utf8");
  const lines = text.split(/\r?\n/);
  const tasks = [];
  let currentTask = null;
  let taskIndex = 0;
  let activeSection = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    if (line.startsWith("## ")) {
      activeSection = line.replace(/^##\s+/, "").trim();
    }

    const match = line.match(/^-\s*\[([ x~!\?])\]\s*(.*)$/);
    if (match) {
      if (currentTask) tasks.push(currentTask);
      taskIndex++;
      const marker = match[1];
      const rest = match[2].trim();

      // Format: - [ ] 🔧 **ID Title** · size · lane — owner, date
      const cardMatch = rest.match(/(?:[^\*]*)\*\*(?:([A-Z0-9_\.]+)\s+)?(.*?)\*\*(?:\s*·\s*([^·]+))?(?:\s*·\s*([^—·]+))?/);
      const cardId = cardMatch && cardMatch[1] ? cardMatch[1].trim() : `card_${taskIndex}`;
      const title = cardMatch && cardMatch[2] ? cardMatch[2].trim() : rest.slice(0, 60);
      const size = cardMatch && cardMatch[3] ? cardMatch[3].trim() : "M";
      const lane = cardMatch && cardMatch[4] ? cardMatch[4].trim() : activeSection.includes("Desk") ? "Desk" : "Build";

      currentTask = {
        id: `nb_${cardId.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${taskIndex}`,
        cardId,
        source: "notes-repo",
        section: activeSection,
        completed: marker.toLowerCase() === "x",
        marker,
        title,
        size,
        lane,
        raw: line,
        body: "",
        file: "",
        acceptance: "",
        priority: size.includes("L") ? "High" : size.includes("M") ? "Medium" : "Low",
        owner: lane === "Build" ? "lead / build" : "desk subagent",
        lineNumber: i + 1,
      };
    } else if (currentTask && line.trim().startsWith("- ")) {
      const subItem = line.trim().replace(/^-\s*/, "");
      if (subItem.toLowerCase().startsWith("goal:")) {
        currentTask.body = subItem.slice(5).trim();
      } else if (subItem.toLowerCase().startsWith("owns:")) {
        currentTask.file = subItem.slice(5).trim();
      } else if (subItem.toLowerCase().startsWith("done when:")) {
        currentTask.acceptance = subItem.slice(10).trim();
      }
    }
  }
  if (currentTask) tasks.push(currentTask);
  return tasks;
}

function parseAllTodos() {
  return {
    workspace: parseWorkspaceTodos(),
    notesRepo: parseNotesTodos(),
    timestamp: Date.now(),
  };
}

// Toggle or update a task in workspace TODO.md
function updateWorkspaceTodo(taskId, updates) {
  if (!fs.existsSync(workspaceTodoPath)) throw new Error("Workspace TODO.md does not exist");
  const content = fs.readFileSync(workspaceTodoPath, "utf8");
  const tasks = parseWorkspaceTodos();
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new Error(`Task with id '${taskId}' not found`);

  const isCRLF = content.includes("\r\n");
  const newline = isCRLF ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const lineIdx = target.lineNumber - 1;
  const currentLine = lines[lineIdx];

  if (typeof updates.completed === "boolean") {
    const newMarker = updates.completed ? "x" : " ";
    lines[lineIdx] = currentLine.replace(/^-\s*\[([ x~!\?])\]/, `- [${newMarker}]`);
  }

  fs.writeFileSync(workspaceTodoPath, lines.join(newline), "utf8");
  return { ok: true, taskId, updatedLine: lines[lineIdx] };
}

// Add a new task to workspace TODO.md
function addWorkspaceTodo(taskData) {
  if (!fs.existsSync(workspaceTodoPath)) throw new Error("Workspace TODO.md does not exist");
  const content = fs.readFileSync(workspaceTodoPath, "utf8");
  const isCRLF = content.includes("\r\n");
  const newline = isCRLF ? "\r\n" : "\n";
  const title = taskData.title?.trim() || "Untitled Task";
  const file = taskData.file?.trim() || "src/main.cpp";
  const body = taskData.body?.trim() || "Implementation task added via Mellangan Web Bridge.";
  const acceptance = taskData.acceptance?.trim() || "Release build passes and --test passes cleanly.";

  const newEntry = `${newline}- [ ] **${title}.** In \`${file}\`, ${body} Done when ${acceptance}${newline}`;
  fs.writeFileSync(workspaceTodoPath, content.trimEnd() + newEntry, "utf8");
  return { ok: true, title, file };
}

// Toggle or update card in notes-bridge/TODO.md
function updateNotesTodo(taskId, updates) {
  if (!fs.existsSync(notesTodoPath)) throw new Error("Notes TODO.md does not exist");
  const content = fs.readFileSync(notesTodoPath, "utf8");
  const tasks = parseNotesTodos();
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new Error(`Notes task with id '${taskId}' not found`);

  const isCRLF = content.includes("\r\n");
  const newline = isCRLF ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const lineIdx = target.lineNumber - 1;
  const currentLine = lines[lineIdx];

  if (typeof updates.completed === "boolean") {
    const newMarker = updates.completed ? "x" : " ";
    lines[lineIdx] = currentLine.replace(/^-\s*\[([ x~!\?])\]/, `- [${newMarker}]`);
  }

  fs.writeFileSync(notesTodoPath, lines.join(newline), "utf8");
  return { ok: true, taskId, updatedLine: lines[lineIdx] };
}

// Git / gh sync handler
function syncNotesRepo(action = "status", commitMessage = "docs(todo): update tasks via web bridge") {
  if (!fs.existsSync(notesBridgeDir)) throw new Error("Notes repo not found on disk");
  try {
    if (action === "pull") {
      const out = execSync("git pull origin main", { cwd: notesBridgeDir, encoding: "utf8" });
      return { ok: true, action: "pull", output: out.trim() };
    } else if (action === "push" || action === "commit") {
      execSync("git add TODO.md NOTES.md", { cwd: notesBridgeDir, encoding: "utf8" });
      let commitOut = "nothing to commit";
      try {
        commitOut = execSync(`git commit -m "${commitMessage}"`, { cwd: notesBridgeDir, encoding: "utf8" });
      } catch (e) {
        // Unchanged
      }
      const pushOut = execSync("git push origin main", { cwd: notesBridgeDir, encoding: "utf8" });
      return { ok: true, action: "push", commitOut: commitOut.trim(), pushOut: pushOut.trim() };
    } else {
      const statusOut = execSync("git status --short", { cwd: notesBridgeDir, encoding: "utf8" });
      return { ok: true, action: "status", status: statusOut.trim() };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

// Helper: send JSON response with CORS
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  });
  res.end(JSON.stringify(data));
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    });
    res.end();
    return;
  }

  // --- Real-Time Server-Sent Events (SSE) Stream ---
  if (pathname === "/api/events" || pathname === "/api/todo/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("event: connected\ndata: {}\n\n");
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  // --- API Routes ---
  try {
    // 1. Bridge Status
    if (pathname === "/api/status" || pathname === "/api/bridge/status") {
      let ghStatus = "connected";
      let ghUser = "soulwax";
      try {
        const ghCheck = execSync("gh auth status", { encoding: "utf8" });
        if (ghCheck.includes("account")) {
          ghUser = (ghCheck.match(/account\s+([a-zA-Z0-9_\-]+)/) || [])[1] || "soulwax";
        }
      } catch {
        ghStatus = "gh-cli-fallback";
      }

      sendJson(res, 200, {
        ok: true,
        bridge: "mellangan-todo-bridge",
        version: "1.0.0",
        ghUser,
        ghStatus,
        workspaceRoot,
        workspaceTodoExists: fs.existsSync(workspaceTodoPath),
        notesRepoExists: fs.existsSync(notesTodoPath),
        timestamp: Date.now(),
      });
      return;
    }

    // 2. GET /api/todos - Read all parsed tasks & raw markdown
    if ((pathname === "/api/todos" || pathname === "/api/todo") && req.method === "GET") {
      const data = parseAllTodos();
      sendJson(res, 200, {
        ok: true,
        ...data,
        rawWorkspace: fs.existsSync(workspaceTodoPath) ? fs.readFileSync(workspaceTodoPath, "utf8") : "",
        rawNotes: fs.existsSync(notesTodoPath) ? fs.readFileSync(notesTodoPath, "utf8") : "",
      });
      return;
    }

    // 3. POST /api/todos - Create new task in workspace TODO
    if ((pathname === "/api/todos" || pathname === "/api/todo") && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const json = JSON.parse(body || "{}");

      const result = addWorkspaceTodo(json);
      broadcast("todo-change", { source: "workspace", timestamp: Date.now(), todos: parseAllTodos() });
      sendJson(res, 201, result);
      return;
    }

    // 4. PUT /api/todos/:id - Update task status / fields
    if ((pathname.startsWith("/api/todos/") || pathname.startsWith("/api/todo/")) && req.method === "PUT") {
      const taskId = pathname.split("/").pop();
      let body = "";
      for await (const chunk of req) body += chunk;
      const updates = JSON.parse(body || "{}");

      let result;
      if (taskId.startsWith("ws_")) {
        result = updateWorkspaceTodo(taskId, updates);
        broadcast("todo-change", { source: "workspace", timestamp: Date.now(), todos: parseAllTodos() });
      } else if (taskId.startsWith("nb_")) {
        result = updateNotesTodo(taskId, updates);
        broadcast("todo-change", { source: "notes-repo", timestamp: Date.now(), todos: parseAllTodos() });
      } else {
        throw new Error(`Unknown task id format: ${taskId}`);
      }

      sendJson(res, 200, result);
      return;
    }

    // 5. POST /api/git/sync - Git & GitHub sync
    if (pathname === "/api/git/sync" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const json = JSON.parse(body || "{}");

      const result = syncNotesRepo(json.action || "push", json.message);
      broadcast("todo-change", { source: "notes-repo", timestamp: Date.now(), todos: parseAllTodos() });
      sendJson(res, 200, result);
      return;
    }

    // Not Found
    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    console.error(`[Bridge Error] ${req.method} ${pathname}:`, err);
    sendJson(res, 500, { ok: false, error: err.message || String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`⚡ Mellangan TODO Real-Time Bridge Server running on http://127.0.0.1:${PORT}`);
  console.log(`   Workspace TODO: ${workspaceTodoPath}`);
  console.log(`   Notes Repo TODO: ${notesTodoPath}`);
  console.log(`   CORS & SSE stream active at http://127.0.0.1:${PORT}/api/events`);
  console.log(`=============================================================\n`);
  setupWatchers();
});
