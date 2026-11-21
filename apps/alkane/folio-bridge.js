(() => {
  const parentOrigin = window.location.origin;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nextFramePair = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function showSaveButton() {
    if (document.getElementById("folio-save-to-folio")) return;
    const button = document.createElement("button");
    button.id = "folio-save-to-folio";
    button.type = "button";
    button.textContent = "Save to Folio";
    button.setAttribute("aria-label", "Save editable Alkane diagram to Folio");
    Object.assign(button.style, {
      position: "fixed", right: "20px", bottom: "20px", zIndex: "2147483000",
      border: "1px solid rgba(255,255,255,.65)", borderRadius: "999px", padding: "11px 16px",
      background: "#4d7058", color: "#fff", font: "600 12px/1.2 Inter,system-ui,sans-serif",
      boxShadow: "0 8px 24px rgba(27,44,31,.22)", cursor: "pointer", letterSpacing: ".01em"
    });
    button.addEventListener("mouseenter", () => { button.style.background = "#3f604a"; });
    button.addEventListener("mouseleave", () => { button.style.background = "#4d7058"; });
    button.addEventListener("click", () => { void saveCurrentDocument(button); });
    document.body.appendChild(button);
  }

  async function openLocalDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("alkane-workspace", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open Alkane storage."));
    });
  }

  async function readCurrentDocument() {
    // Let Alkane's debounced IndexedDB autosave flush the most recent canvas edit.
    await delay(900);
    const id = localStorage.getItem("alkane-last-document");
    if (!id) throw new Error("Create or open a diagram in Alkane first.");
    const db = await openLocalDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction("documents", "readonly").objectStore("documents").get(id);
        request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error("The current diagram was not found in Alkane storage."));
        request.onerror = () => reject(request.error || new Error("Could not read the current diagram."));
      });
    } finally { db.close(); }
  }

  async function saveCurrentDocument(button) {
    const original = "Save to Folio";
    button.disabled = true;
    button.textContent = "Preparing…";
    try {
      const documentData = await readCurrentDocument();
      if (!documentData || documentData.schemaVersion !== 1 || !Array.isArray(documentData.boards) || !documentData.boards.length) {
        throw new Error("This diagram uses an unsupported format.");
      }
      button.textContent = "Sending to Folio…";
      window.parent.postMessage({ type: "folio:save-alkane", document: documentData }, parentOrigin);
      button.textContent = "Waiting for Folio…";
      window.setTimeout(() => {
        if (button.textContent === "Waiting for Folio…") {
          button.disabled = false;
          button.textContent = original;
          button.title = "No response from Folio. Check your connection and try again.";
        }
      }, 12000);
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      window.parent.postMessage({ type: "folio:alkane-error", message: error instanceof Error ? error.message : "Could not prepare this diagram." }, parentOrigin);
    }
  }

  async function handleParentMessage(event) {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type === "folio:save-current-alkane") {
      const button = document.getElementById("folio-save-to-folio");
      if (button) await saveCurrentDocument(button);
    }
    if (message.type === "folio:save-alkane-result") {
      const button = document.getElementById("folio-save-to-folio");
      if (!button) return;
      button.disabled = false;
      button.textContent = message.ok ? "Saved to Folio ✓" : "Save failed — try again";
      if (!message.ok && typeof message.error === "string") button.title = message.error;
      window.setTimeout(() => {
        if (button.isConnected) {
          button.textContent = "Save to Folio";
          button.title = "Save this editable diagram to your Folio workspace";
        }
      }, 3600);
    }
    if (message.type === "folio:open-alkane-document" && message.document && typeof message.document === "object") {
      let db;
      try {
        const documentData = message.document;
        if (documentData.schemaVersion !== 1 || !Array.isArray(documentData.boards) || !documentData.boards.length) {
          throw new Error("Unsupported saved document format.");
        }
        db = await openLocalDatabase();
        const id = typeof documentData.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentData.id) ? documentData.id : crypto.randomUUID();
        const copy = { ...documentData, id, title: typeof documentData.title === "string" ? documentData.title : "Saved Folio diagram", modifiedAt: new Date().toISOString() };
        await new Promise((resolve, reject) => {
          const transaction = db.transaction("documents", "readwrite");
          transaction.objectStore("documents").put(copy);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error || new Error("Could not open the saved diagram."));
          transaction.onabort = () => reject(transaction.error || new Error("Could not open the saved diagram."));
        });
        localStorage.setItem("alkane-last-document", id);
        localStorage.setItem("alkane-initialized", "true");
        window.location.reload();
      } catch (error) {
        window.parent.postMessage({ type: "folio:alkane-error", message: error instanceof Error ? error.message : "Could not open this Folio diagram." }, parentOrigin);
      } finally {
        db?.close();
      }
    }
  }

  let dragLayerId = null;
  let dragTargetId = null;
  async function reorderLayer(sourceId, targetId) {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const rows = Array.from(document.querySelectorAll(".layer-row[data-layer-id]"));
      const from = rows.findIndex((row) => row.dataset.layerId === sourceId);
      const to = rows.findIndex((row) => row.dataset.layerId === targetId);
      if (from < 0 || to < 0 || from === to) return;
      const source = rows[from];
      const action = from > to ? "Bring forward" : "Send backward";
      const rect = source.getBoundingClientRect();
      source.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true, cancelable: true, clientX: rect.left + 12, clientY: rect.top + 12
      }));
      await nextFramePair();
      const menu = document.querySelector(".context-menu");
      const item = Array.from(menu?.querySelectorAll('[role="menuitem"]') || [])
        .find((element) => element.textContent?.includes(action));
      if (!item || item.hasAttribute("disabled")) return;
      item.click();
      await nextFramePair();
    }
  }

  function installLayerDragAndDrop() {
    const root = document.querySelector(".outline-scroll");
    if (!root || root.dataset.folioDnDReady === "true") return;
    root.dataset.folioDnDReady = "true";
    const markRows = () => document.querySelectorAll(".layer-row[data-layer-id]").forEach((row) => {
      if (row.dataset.folioDraggable === "true") return;
      row.dataset.folioDraggable = "true";
      if (row.dataset.layerLocked !== "true") row.draggable = true;
      row.title = row.dataset.layerLocked === "true" ? "Locked layer" : "Drag to change layer order";
    });
    markRows();
    const observer = new MutationObserver(markRows);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("dragstart", (event) => {
      const row = event.target instanceof Element ? event.target.closest(".layer-row[data-layer-id]") : null;
      if (!row || row.dataset.layerLocked === "true") { event.preventDefault(); return; }
      dragLayerId = row.dataset.layerId || null;
      if (!dragLayerId) return;
      event.dataTransfer?.setData("text/plain", dragLayerId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    root.addEventListener("dragover", (event) => {
      if (!dragLayerId) return;
      const row = event.target instanceof Element ? event.target.closest(".layer-row[data-layer-id]") : null;
      if (!row || row.dataset.layerId === dragLayerId || row.dataset.layerLocked === "true") return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".folio-layer-drop-target").forEach((element) => element.classList.remove("folio-layer-drop-target"));
      dragTargetId = row.dataset.layerId || null;
      row.classList.add("folio-layer-drop-target");
    });
    root.addEventListener("drop", (event) => {
      if (!dragLayerId) return;
      const row = event.target instanceof Element ? event.target.closest(".layer-row[data-layer-id]") : null;
      const sourceId = dragLayerId;
      const targetId = row?.dataset.layerId || dragTargetId;
      event.preventDefault();
      document.querySelectorAll(".folio-layer-drop-target").forEach((element) => element.classList.remove("folio-layer-drop-target"));
      dragLayerId = null;
      dragTargetId = null;
      if (targetId && targetId !== sourceId) void reorderLayer(sourceId, targetId);
    });
    root.addEventListener("dragend", () => {
      dragLayerId = null;
      dragTargetId = null;
      document.querySelectorAll(".folio-layer-drop-target").forEach((element) => element.classList.remove("folio-layer-drop-target"));
    });
  }

  function boot() {
    showSaveButton();
    installLayerDragAndDrop();
    const observer = new MutationObserver(() => { showSaveButton(); installLayerDragAndDrop(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("message", handleParentMessage);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
