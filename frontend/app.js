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
let uiLang = "en";

const uiCopy = {
  en: {
    brand: "NST Engine",
    tagline: "Image style workbench",
    apiDocs: "API Docs",
    repo: "Repository",
    eyebrow: "PyTorch image lab",
    headline: "Blend a photo with a reference style.",
    lede: "Upload one content image, one style image, tune the optimization, then let the backend produce a stylized PNG.",
    contentImage: "Content image",
    contentHint: "The photo or scene to preserve.",
    styleImage: "Style image",
    styleHint: "The color, texture, and brushwork source.",
    runSetup: "Run setup",
    iterations: "Iterations",
    styleWeight: "Style weight",
    runTransfer: "Run transfer",
    contentNoteTitle: "Content",
    contentNote: "Preserves structure and object layout.",
    styleNoteTitle: "Style",
    styleNote: "Transfers texture statistics through Gram loss.",
    outputNoteTitle: "Output",
    outputNote: "Available as a PNG when the job completes.",
    featureTitle: "Feature extraction",
    featureCopy: "VGG19 reads content and style features from selected convolutional layers.",
    optimizationTitle: "Optimization",
    optimizationCopy: "L-BFGS updates the output image directly instead of training a new model.",
    deliveryTitle: "Delivery",
    deliveryCopy: "The FastAPI backend runs jobs asynchronously and serves completed images."
  },
  es: {
    brand: "NST Engine",
    tagline: "Estudio visual de transferencia",
    apiDocs: "Docs API",
    repo: "Repositorio",
    eyebrow: "Laboratorio de imagen con PyTorch",
    headline: "Mezcla una foto con un estilo de referencia.",
    lede: "Sube una imagen de contenido y una de estilo, ajusta la optimizacion y deja que el backend genere un PNG estilizado.",
    contentImage: "Imagen base",
    contentHint: "La foto o escena que quieres conservar.",
    styleImage: "Imagen de estilo",
    styleHint: "La fuente de color, textura y trazos.",
    runSetup: "Configuracion",
    iterations: "Iteraciones",
    styleWeight: "Peso de estilo",
    runTransfer: "Ejecutar transferencia",
    contentNoteTitle: "Contenido",
    contentNote: "Conserva estructura y composicion.",
    styleNoteTitle: "Estilo",
    styleNote: "Transfiere texturas usando Gram loss.",
    outputNoteTitle: "Salida",
    outputNote: "Disponible como PNG al terminar el trabajo.",
    featureTitle: "Extraccion de rasgos",
    featureCopy: "VGG19 lee rasgos de contenido y estilo desde capas convolucionales.",
    optimizationTitle: "Optimizacion",
    optimizationCopy: "L-BFGS actualiza la imagen final directamente sin entrenar un modelo nuevo.",
    deliveryTitle: "Entrega",
    deliveryCopy: "FastAPI ejecuta trabajos asincronos y sirve las imagenes completadas."
  }
};

function applyUiLanguage(nextLang) {
  uiLang = nextLang;
  document.documentElement.lang = uiLang;
  const toggle = document.querySelector(".language-switch");
  if (toggle) toggle.setAttribute("aria-pressed", String(uiLang === "es"));
  document.querySelectorAll("[data-i18n]").forEach(node => {
    const value = uiCopy[uiLang][node.dataset.i18n];
    if (value) node.textContent = value;
  });
}

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

function setStatus(status, jobId, message) {
  statusBar.hidden = false;
  statusIndicator.className = "status-indicator";
  if (status === "completed") statusIndicator.classList.add("completed");
  if (status === "failed") statusIndicator.classList.add("failed");
  statusText.textContent = message || (status.charAt(0).toUpperCase() + status.slice(1));
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
      setStatus("failed", jobId, `Transfer failed: ${data.error || "unknown error"}`);
    }
  } catch {
    clearInterval(pollingInterval);
    setLoading(false);
    setStatus("failed", null, "Network error while polling status.");
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

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  resultPanel.hidden = true;
  resultImage.src = "";
  statusBar.hidden = true;
  setLoading(true);

  const formData = new FormData();
  formData.append("content_image", contentFile);
  formData.append("style_image", styleFile);
  formData.append("iterations", iterationsInput.value);
  formData.append("style_weight", styleWeightInput.value);

  try {
    const res = await fetch(`${API_BASE}/style/transfer`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch {}
      setLoading(false);
      setStatus("failed", null, `API error: ${detail}`);
      return;
    }

    const data = await res.json();
    currentJobId = data.job_id;
    setStatus("queued", currentJobId, "Queued - processing may take 1-3 minutes");

    pollingInterval = setInterval(() => pollJob(currentJobId), 3000);
  } catch {
    setLoading(false);
    setStatus("failed", null, "Cannot reach the API. Run 'python server.py' to start the backend.");
  }
});

document.querySelector(".language-switch")?.addEventListener("click", () => {
  applyUiLanguage(uiLang === "en" ? "es" : "en");
});

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: 0.16 });

document.querySelectorAll("[data-reveal]").forEach(node => revealObserver.observe(node));
applyUiLanguage(uiLang);
