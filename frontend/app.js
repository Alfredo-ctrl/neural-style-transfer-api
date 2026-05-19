const API_BASE = "";

const contentInput = document.getElementById("content-input");
const styleInput = document.getElementById("style-input");
const contentZone = document.getElementById("content-zone");
const styleZone = document.getElementById("style-zone");
const contentCard = document.getElementById("content-card");
const styleCard = document.getElementById("style-card");
const contentPreview = document.getElementById("content-preview");
const stylePreview = document.getElementById("style-preview");
const transferBtn = document.getElementById("transfer-btn");
const btnText = transferBtn.querySelector(".btn-text");
const btnSpinner = transferBtn.querySelector(".btn-spinner");
const statusBar = document.getElementById("status-bar");
const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
const jobIdDisplay = document.getElementById("job-id-display");
const resultPanel = document.getElementById("result-panel");
const resultImage = document.getElementById("result-image");
const downloadBtn = document.getElementById("download-btn");
const iterationsInput = document.getElementById("iterations-input");
const iterationsVal = document.getElementById("iterations-val");
const styleWeightInput = document.getElementById("style-weight-input");
const styleWeightVal = document.getElementById("style-weight-val");

let contentFile = null;
let styleFile = null;
let pollingInterval = null;
let currentJobId = null;

function formatStyleWeight(val) {
  const n = parseInt(val, 10);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

iterationsInput.addEventListener("input", () => {
  iterationsVal.textContent = iterationsInput.value;
});

styleWeightInput.addEventListener("input", () => {
  styleWeightVal.textContent = formatStyleWeight(styleWeightInput.value);
});

function setupDropZone(zone, input, onFile) {
  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });

  input.addEventListener("change", () => {
    if (input.files[0]) onFile(input.files[0]);
  });
}

function previewFile(file, imgEl, card) {
  const reader = new FileReader();
  reader.onload = (e) => {
    imgEl.src = e.target.result;
    card.classList.add("has-image");
  };
  reader.readAsDataURL(file);
}

setupDropZone(contentZone, contentInput, (file) => {
  contentFile = file;
  previewFile(file, contentPreview, contentCard);
  updateTransferBtn();
});

setupDropZone(styleZone, styleInput, (file) => {
  styleFile = file;
  previewFile(file, stylePreview, styleCard);
  updateTransferBtn();
});

function updateTransferBtn() {
  transferBtn.disabled = !(contentFile && styleFile);
}

function setLoading(loading) {
  if (loading) {
    btnText.hidden = true;
    btnSpinner.hidden = false;
    transferBtn.disabled = true;
  } else {
    btnText.hidden = false;
    btnSpinner.hidden = true;
    updateTransferBtn();
  }
}

function setStatus(status, jobId) {
  statusBar.hidden = false;
  statusIndicator.className = "status-indicator";
  if (status === "completed") statusIndicator.classList.add("completed");
  if (status === "failed") statusIndicator.classList.add("failed");
  statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  jobIdDisplay.textContent = jobId ? `#${jobId.slice(0, 8)}` : "";
}

async function pollJob(jobId) {
  try {
    const res = await fetch(`${API_BASE}/style/status/${jobId}`);
    const data = await res.json();
    setStatus(data.status, jobId);

    if (data.status === "completed") {
      clearInterval(pollingInterval);
      setLoading(false);
      showResult(jobId);
    } else if (data.status === "failed") {
      clearInterval(pollingInterval);
      setLoading(false);
      statusText.textContent = `Failed: ${data.error || "unknown error"}`;
    }
  } catch {
    clearInterval(pollingInterval);
    setLoading(false);
    statusText.textContent = "Network error while polling.";
  }
}

async function showResult(jobId) {
  const url = `${API_BASE}/style/result/${jobId}`;
  resultImage.src = url;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: "smooth", block: "center" });

  downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `stylized_${jobId}.png`;
    a.click();
  };
}

transferBtn.addEventListener("click", async () => {
  if (!contentFile || !styleFile) return;

  resultPanel.hidden = true;
  setLoading(true);

  const formData = new FormData();
  formData.append("content_image", contentFile);
  formData.append("style_image", styleFile);

  try {
    const res = await fetch(`${API_BASE}/style/transfer`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      setLoading(false);
      setStatus("failed", null);
      statusText.textContent = `Error: ${err.detail || res.statusText}`;
      return;
    }

    const data = await res.json();
    currentJobId = data.job_id;
    setStatus("queued", currentJobId);
    statusBar.hidden = false;

    pollingInterval = setInterval(() => pollJob(currentJobId), 3000);
  } catch {
    setLoading(false);
    setStatus("failed", null);
    statusText.textContent = "Failed to submit job. Is the server running?";
  }
});
