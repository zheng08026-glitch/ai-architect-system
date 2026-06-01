const systems = [
  {
    id: "A1",
    title: "Prompt Basic",
    subtitle: "真實圖轉建築提示詞",
    desc: "上傳真實建築照片或渲染圖，快速萃取建築風格、立面、材質與構圖語彙。",
    tier: "Free",
    status: "Live System",
    result: "prompt",
    inputs: [{ key: "building", label: "真實建築照片 / 渲染參考圖" }],
    count: false,
    prompt: false,
  },
  {
    id: "A2",
    title: "Prompt Precision",
    subtitle: "精準建築提示詞",
    desc: "針對真實建築照片進行更精準的語彙整理，輸出可直接用於後續視覺生成的關鍵字。",
    tier: "Free",
    status: "Live System",
    result: "prompt",
    inputs: [{ key: "building", label: "真實建築照片 / 渲染參考圖" }],
    count: false,
    prompt: false,
  },
  {
    id: "A3",
    title: "Sketch Prompt",
    subtitle: "自行提詞 + Sketch",
    desc: "上傳草圖、3D 量體或基地初稿，搭配自行輸入的建築提示詞產生外觀提案。",
    tier: "Free",
    status: "Live System",
    result: "image",
    inputs: [{ key: "sketch", label: "Sketch / 3D 量體圖" }],
    count: true,
    prompt: true,
  },
  {
    id: "A4",
    title: "Style Sketch",
    subtitle: "風格圖 + Sketch",
    desc: "以草圖或量體圖為基礎，加入風格參考圖，產生符合指定材質與立面語彙的外觀提案。",
    tier: "Free",
    status: "Live System",
    result: "image",
    inputs: [
      { key: "sketch", label: "Sketch / 3D 量體圖" },
      { key: "style", label: "風格參考圖" },
    ],
    count: true,
    prompt: false,
  },
  {
    id: "A5",
    title: "Style Sketch Site",
    subtitle: "風格圖 + Sketch + Site",
    desc: "整合主建築量體、風格參考與基地周邊關係，產出更貼近提案討論情境的建築外觀圖。",
    tier: "Free",
    status: "Live System",
    result: "image",
    inputs: [
      { key: "sketch", label: "Sketch / 3D 量體圖" },
      { key: "style", label: "風格參考圖" },
      { key: "site", label: "基地與周邊環境圖" },
    ],
    count: true,
    prompt: false,
  },
  {
    id: "A6",
    title: "Style Sketch 2K",
    subtitle: "風格圖 + Sketch + 2K",
    desc: "針對需要簡報與提案輸出的情境，產出高解析建築渲染。",
    tier: "Plus",
    status: "Under Construction",
    result: "image",
    inputs: [
      { key: "sketch", label: "Sketch / 3D 量體圖" },
      { key: "style", label: "風格參考圖" },
    ],
    count: true,
    prompt: false,
  },
  {
    id: "A7",
    title: "Style Sketch Site 2K",
    subtitle: "風格圖 + Sketch + Site + 2K",
    desc: "將風格、量體與基地整合後輸出高解析提案圖。",
    tier: "Plus",
    status: "Under Construction",
    result: "image",
    inputs: [
      { key: "sketch", label: "Sketch / 3D 量體圖" },
      { key: "style", label: "風格參考圖" },
      { key: "site", label: "基地與周邊環境圖" },
    ],
    count: true,
    prompt: false,
  },
  {
    id: "A8",
    title: "Full Control Mode",
    subtitle: "提詞 + Sketch + Site + 2K",
    desc: "提供更高控制度的商業生成模式，適合專案正式提案與團隊使用。",
    tier: "Pro",
    status: "Planned",
    result: "image",
    inputs: [
      { key: "sketch", label: "Sketch / 3D 量體圖" },
      { key: "style", label: "風格參考圖" },
      { key: "site", label: "基地與周邊環境圖" },
      { key: "depth", label: "控制參考圖" },
    ],
    count: true,
    prompt: true,
  },
  {
    id: "A9",
    title: "Motion Render",
    subtitle: "AI 建築動畫輸出",
    desc: "將建築透視圖轉為鏡頭動畫，服務建商、代銷與簡報需求。",
    tier: "Pro",
    status: "Planned",
    result: "image",
    inputs: [{ key: "render", label: "建築透視圖 / Render" }],
    count: true,
    prompt: true,
  },
];

let activeId = "A1";
const previews = new Map();
const uploadedFiles = new Map();

const $ = (selector) => document.querySelector(selector);
const systemList = $("#systemList");
const systemsGrid = $("#systemsGrid");
const inputStack = $("#inputStack");
const activeTier = $("#activeTier");
const activeTitle = $("#activeTitle");
const activeDesc = $("#activeDesc");
const activeStatus = $("#activeStatus");
const resultTitle = $("#resultTitle");
const promptOutput = $("#promptOutput");
const renderOutput = $("#renderOutput");
const mainPreview = $("#mainPreview");
const thumbGrid = $("#thumbGrid");
const authButton = $("#authButton");
const authEmail = $("#authEmail");
const authSubmit = $("#authSubmit");
const authMessage = $("#authMessage");
const AUTH_TOKEN_KEY = "architect-ai-auth-token";
const AUTH_EMAIL_KEY = "architect-ai-auth-email";
const CLIENT_ID_KEY = "architect-ai-client-id";

function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function getAuthEmail() {
  return localStorage.getItem(AUTH_EMAIL_KEY) || "";
}

function updateAuthUi() {
  const email = getAuthEmail();
  if (authButton) authButton.textContent = email ? email : "登入";
  if (authMessage) {
    authMessage.textContent = email
      ? `已登入：${email}`
      : "目前為封測版 Email 登入，正式付款前不收費。";
  }
}

function requiresMember(system) {
  return ["A3", "A4", "A5"].includes(system.id);
}

function getActiveSystem() {
  return systems.find((system) => system.id === activeId) || systems[0];
}

function systemButton(system) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `system-button ${system.id === activeId ? "active" : ""}`;
  button.disabled = system.status !== "Live System";
  button.innerHTML = `
    <span class="system-id">${system.id}</span>
    <span><strong>${system.title}</strong><small>${system.subtitle}</small></span>
    <span class="tier-chip">${system.tier}</span>
  `;
  button.addEventListener("click", () => {
    if (system.status !== "Live System") return;
    activeId = system.id;
    renderApp();
    document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return button;
}

function systemCard(system) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `system-card ${system.status === "Live System" ? "" : "locked"}`;
  card.disabled = system.status !== "Live System";
  card.innerHTML = `
    <div class="system-card-top">
      <span class="system-id">${system.id}</span>
      <span class="status-pill ${system.status === "Live System" ? "with-dot" : "pending"}">${system.status}</span>
    </div>
    <h3>${system.title}</h3>
    <p>${system.subtitle}</p>
    <div class="system-meta">
      <span class="tier-chip">${system.tier}</span>
      <span class="card-arrow">→</span>
    </div>
  `;
  card.addEventListener("click", () => {
    if (system.status !== "Live System") return;
    activeId = system.id;
    renderApp();
    document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return card;
}

function uploadField(input) {
  const wrapper = document.createElement("div");
  wrapper.className = "upload-box";
  const key = `${activeId}-${input.key}`;
  const src = previews.get(key);
  wrapper.innerHTML = `
    <span class="upload-label">${input.label}</span>
    <label class="drop-zone">
      ${src ? `<img src="${src}" alt="${input.label} preview" />` : "<span>上傳 / 預覽 / 更換</span>"}
      <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="${input.label}" />
    </label>
  `;
  wrapper.querySelector("input").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      previews.set(key, reader.result);
      uploadedFiles.set(key, file);
      renderApp();
    };
    reader.readAsDataURL(file);
  });
  return wrapper;
}

function textPromptField() {
  const wrapper = document.createElement("div");
  wrapper.className = "field-box";
  wrapper.innerHTML = `
    <label for="customPrompt">建築提示詞</label>
    <textarea id="customPrompt" placeholder="例如：低樓層集合住宅、清水混凝土、深窗框、街角基地、柔和日光..."></textarea>
  `;
  return wrapper;
}

function countField() {
  const wrapper = document.createElement("div");
  wrapper.className = "field-box";
  wrapper.innerHTML = `
    <label for="outputCount">輸出張數</label>
    <select id="outputCount">
      <option>1 張 - 單張測試</option>
      <option>6 張 - 多方案輸出</option>
    </select>
  `;
  return wrapper;
}

function renderInputs(system) {
  inputStack.innerHTML = "";
  system.inputs.forEach((input) => inputStack.append(uploadField(input)));
  if (system.prompt) inputStack.append(textPromptField());
  if (system.count) inputStack.append(countField());

  const generateButton = document.createElement("button");
  generateButton.className = "generate-button";
  generateButton.type = "button";
  generateButton.textContent = system.result === "prompt" ? "產生提示詞" : "產生建築圖";
  generateButton.addEventListener("click", submitOrSimulateGenerate);
  inputStack.append(generateButton);
}

function renderResult(system) {
  const isPrompt = system.result === "prompt";
  resultTitle.textContent = isPrompt ? "提示詞結果" : "建築圖結果";
  promptOutput.classList.toggle("hidden", !isPrompt);
  renderOutput.classList.toggle("hidden", isPrompt);

  if (isPrompt) return;

  const uploadedImages = system.inputs
    .map((input) => previews.get(`${system.id}-${input.key}`))
    .filter(Boolean);

  const firstImage = uploadedImages[0];
  mainPreview.innerHTML = firstImage
    ? `<img src="${firstImage}" alt="主要預覽圖" />`
    : "<span>上傳圖片後可先確認預覽，送出後會顯示生成成果。</span>";

  thumbGrid.innerHTML = "";
  for (let index = 0; index < 6; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    const image = uploadedImages[index % uploadedImages.length];
    button.innerHTML = image ? `<img src="${image}" alt="Preview ${index + 1}" />` : `Preview ${index + 1}`;
    button.addEventListener("click", () => {
      if (image) mainPreview.innerHTML = `<img src="${image}" alt="主要預覽圖" />`;
    });
    thumbGrid.append(button);
  }
}

function getApiBase() {
  return (window.ARCHITECT_AI_API_BASE || "").replace(/\/$/, "");
}

function fieldNameForInput(input) {
  if (input.key === "building") return "image";
  if (input.key === "style") return "style_image";
  if (input.key === "site") return "site_image";
  return input.key;
}

function setImageResults(imageUrls) {
  if (!imageUrls.length) {
    mainPreview.innerHTML = "<span>任務完成，但沒有收到可顯示的成果圖。</span>";
    return;
  }

  mainPreview.innerHTML = `<img src="${imageUrls[0]}" alt="AI render result" />`;
  thumbGrid.innerHTML = "";
  imageUrls.forEach((imageUrl, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<img src="${imageUrl}" alt="Result ${index + 1}" />`;
    button.addEventListener("click", () => {
      mainPreview.innerHTML = `<img src="${imageUrl}" alt="AI render result" />`;
    });
    thumbGrid.append(button);
  });
}

async function pollJob(jobId, system) {
  const apiBase = getApiBase();
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const response = await fetch(`${apiBase}/api/jobs/${jobId}`);
    if (!response.ok) throw new Error("無法取得任務狀態");
    const job = await response.json();

    if (job.status === "completed") {
      if (system.result === "prompt") {
        promptOutput.textContent = job.output_text || "任務完成，但沒有收到提示詞。";
      } else {
        setImageResults(job.output_images || (job.output_image ? [job.output_image] : []));
      }
      return;
    }

    if (job.status === "failed") {
      throw new Error(job.error || "任務失敗");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }

  throw new Error("等待時間過長，請稍後再查看結果");
}

function validateInputs(system) {
  const missing = system.inputs.filter((input) => !uploadedFiles.get(`${system.id}-${input.key}`));
  if (missing.length) {
    return `請先上傳：${missing.map((input) => input.label).join("、")}`;
  }
  return "";
}

async function submitRealJob(system) {
  if (requiresMember(system) && !getAuthToken()) {
    authMessage.textContent = "請先登入會員後再使用 A3-A5。";
    authDialog.showModal();
    throw new Error("請先登入會員後再使用 A3-A5");
  }

  const validationError = validateInputs(system);
  if (validationError) throw new Error(validationError);

  const formData = new FormData();
  formData.append("system_id", system.id);
  formData.append("prompt", $("#customPrompt")?.value || "");
  formData.append("count", ($("#outputCount")?.value || "1").trim().startsWith("6") ? "6" : "1");
  formData.append("client_id", getClientId());

  system.inputs.forEach((input) => {
    const file = uploadedFiles.get(`${system.id}-${input.key}`);
    if (file) formData.append(fieldNameForInput(input), file);
  });

  const apiBase = getApiBase();
  const headers = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiBase}/api/jobs`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "任務送出失敗");
  }

  const data = await response.json();
  if (system.result === "prompt") {
    promptOutput.textContent = "任務已送出，正在產生提示詞...";
  } else {
    mainPreview.innerHTML = "<span>任務已送出，正在產生建築圖...</span>";
    thumbGrid.innerHTML = "";
  }

  await pollJob(data.job_id, system);
}

async function submitOrSimulateGenerate() {
  const system = getActiveSystem();
  if (system.status !== "Live System") {
    if (system.result === "prompt") {
      promptOutput.textContent = "此系統尚未開放。";
    } else {
      mainPreview.innerHTML = "<span>此系統尚未開放。</span>";
    }
    return;
  }

  if (!getApiBase()) {
    simulateGenerate();
    return;
  }

  try {
    await submitRealJob(system);
  } catch (error) {
    if (system.result === "prompt") {
      promptOutput.textContent = `任務未完成：${error.message}`;
    } else {
      mainPreview.innerHTML = `<span>任務未完成：${error.message}</span>`;
    }
  }
}

function simulateGenerate() {
  const system = getActiveSystem();
  if (system.result === "prompt") {
    promptOutput.textContent =
      "urban high-rise tower, vertical facade rhythm, glass curtain wall, refined podium base, warm daylight, dense urban context, professional architectural visualization";
    return;
  }

  mainPreview.innerHTML = "<span>展示模式已建立預覽。正式 API 啟用後會送出任務並回傳生成成果。</span>";
}

function renderApp() {
  const system = getActiveSystem();

  systemList.innerHTML = "";
  systems.forEach((item) => systemList.append(systemButton(item)));

  systemsGrid.innerHTML = "";
  systems.forEach((item) => systemsGrid.append(systemCard(item)));

  activeTier.textContent = `${system.tier} Access`;
  activeTitle.textContent = `${system.id} ${system.title}`;
  activeDesc.textContent = system.desc;
  activeStatus.textContent = system.status;
  activeStatus.classList.toggle("pending", system.status !== "Live System");

  renderInputs(system);
  renderResult(system);
}

$("#copyResult").addEventListener("click", async () => {
  const system = getActiveSystem();
  const text =
    system.result === "prompt"
      ? promptOutput.textContent.trim()
      : "成果圖可在結果區預覽與下載。";
  try {
    await navigator.clipboard.writeText(text);
    $("#copyResult").textContent = "Copied";
    window.setTimeout(() => ($("#copyResult").textContent = "Copy"), 1200);
  } catch {
    $("#copyResult").textContent = "Copy failed";
    window.setTimeout(() => ($("#copyResult").textContent = "Copy"), 1200);
  }
});

$("#downloadResult").addEventListener("click", () => {
  const system = getActiveSystem();
  if (system.result !== "prompt") return;

  const blob = new Blob([promptOutput.textContent.trim()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeId.toLowerCase()}-architect-ai-result.txt`;
  link.click();
  URL.revokeObjectURL(url);
});

const authDialog = $("#authDialog");
document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => authDialog.showModal());
});

async function loginWithEmail() {
  const email = authEmail?.value.trim();
  if (!email) {
    authMessage.textContent = "請輸入 Email。";
    return;
  }

  const apiBase = getApiBase();
  if (!apiBase) {
    authMessage.textContent = "尚未設定 API，無法登入。";
    return;
  }

  const formData = new FormData();
  formData.append("email", email);
  authSubmit.disabled = true;
  authMessage.textContent = "登入中...";

  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "登入失敗");
    }
    const data = await response.json();
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_EMAIL_KEY, data.member?.email || email);
    updateAuthUi();
    authDialog.close();
  } catch (error) {
    authMessage.textContent = error.message || "登入失敗";
  } finally {
    authSubmit.disabled = false;
  }
}

authSubmit?.addEventListener("click", loginWithEmail);
authEmail?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loginWithEmail();
  }
});

const themeButtons = document.querySelectorAll("[data-theme-option]");

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("architect-ai-theme", theme);
  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeOption === theme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeOption));
});

setTheme(localStorage.getItem("architect-ai-theme") || "violet");
updateAuthUi();

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.scrollTarget);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 78;
    window.scrollTo({ top, behavior: "smooth" });
  });
});

renderApp();
