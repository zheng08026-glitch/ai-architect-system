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
    title: "Style Sketch HD",
    subtitle: "風格圖 + Sketch + HD",
    desc: "針對需要簡報與提案輸出的情境，產出高解析建築渲染。",
    tier: "Plus",
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
    id: "A7",
    title: "Style Sketch Site HD",
    subtitle: "風格圖 + Sketch + Site + HD",
    desc: "將風格、量體與基地整合後輸出高解析提案圖。",
    tier: "Plus",
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
    id: "A8-1",
    gridDisplayId: "A8",
    title: "HD Enhance",
    subtitle: "建築圖片快速高畫質放大",
    desc: "使用AI推算直接放大圖形解析度，適合一般高解析輸出。",
    tier: "Pro",
    status: "Live System",
    result: "image",
    inputs: [{ key: "building", label: "待增強建築圖片" }],
    count: false,
    prompt: false,
  },
  {
    id: "A8-2",
    activeTitle: "A8-2 Rerender",
    title: "Rerender",
    subtitle: "AI自動判斷重繪",
    desc: "使用 AI 判斷重新演算繪圖，強化材質、紋理與細節，亦適合模糊圖片轉為高品質。",
    tier: "Pro",
    status: "Live System",
    result: "image",
    inputs: [{ key: "building", label: "待重繪建築圖片" }],
    count: false,
    prompt: false,
  },
  {
    id: "A9-1",
    gridDisplayId: "A9",
    activeTitle: "A9-1｜AI Motion Render",
    title: "AI Motion Render",
    subtitle: "單張圖像轉 AI 建築動畫",
    desc: "上傳 1 張建築圖像並選擇鏡頭提示詞，生成具有運鏡效果的 AI 動畫影片。",
    tier: "Pro",
    status: "Live System",
    result: "video",
    inputs: [{ key: "image", label: "建築圖像 / Render" }],
    count: false,
    prompt: true,
  },
  {
    id: "A9-2",
    activeTitle: "A9_V2｜AI Motion Render",
    title: "AI Motion Render",
    subtitle: "7 張關鍵圖像轉 AI 動畫",
    desc: "依序上傳 7 張關鍵圖像，等待約 10 分鐘生成一段 AI 動畫影片。適用於施工動畫模擬、立面表情轉換與室內場景變化。",
    tier: "Pro",
    status: "Live System",
    result: "video",
    inputs: [
      { key: "image_1", label: "關鍵圖像 1｜起始畫面" },
      { key: "image_2", label: "關鍵圖像 2" },
      { key: "image_3", label: "關鍵圖像 3" },
      { key: "image_4", label: "關鍵圖像 4" },
      { key: "image_5", label: "關鍵圖像 5" },
      { key: "image_6", label: "關鍵圖像 6" },
      { key: "image_7", label: "關鍵圖像 7｜結束畫面" },
    ],
    count: false,
    prompt: false,
  },
];

let activeId = "A1";
const previews = new Map();
const uploadedFiles = new Map();
let activeResultUrl = "";
let activeResultType = "";
let activeResultBlob = null;
let activeResultBlobPromise = null;

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
const adminButton = $("#adminButton");
const memberAdminButton = $("#memberAdminButton");
const adminDialog = $("#adminDialog");
const adminMessage = $("#adminMessage");
const adminOverview = $("#adminOverview");
const adminMemberList = $("#adminMemberList");
const adminRefresh = $("#adminRefresh");
const adminDetail = $("#adminDetail");
const adminDetailTitle = $("#adminDetailTitle");
const adminDetailContent = $("#adminDetailContent");
const adminDetailClose = $("#adminDetailClose");
const authEmail = $("#authEmail");
const authPassword = $("#authPassword");
const authSubmit = $("#authSubmit");
const authRegister = $("#authRegister");
const authReset = $("#authReset");
const authGoogle = $("#authGoogle");
const authMessage = $("#authMessage");
const authFormPanel = $("#authFormPanel");
const authSignOut = $("#authSignOut");
const memberPanel = $("#memberPanel");
const memberSummary = $("#memberSummary");
const profileForm = $("#profileForm");
const usageList = $("#usageList");
const jobList = $("#jobList");
const profileFields = {
  name: $("#profileName"),
  company: $("#profileCompany"),
  phone: $("#profilePhone"),
  tax_id: $("#profileTaxId"),
  invoice_title: $("#profileInvoiceTitle"),
  profession: $("#profileProfession"),
};
const AUTH_TOKEN_KEY = "architect-ai-auth-token";
const AUTH_EMAIL_KEY = "architect-ai-auth-email";
const CLIENT_ID_KEY = "architect-ai-client-id";
let memberJobs = [];
let currentMember = null;

function getSupabaseConfig() {
  return {
    url: (window.ARCHITECT_AI_SUPABASE_URL || "").trim(),
    key: (window.ARCHITECT_AI_SUPABASE_ANON_KEY || "").trim(),
  };
}

function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.key && window.supabase?.createClient);
}

let supabaseClient = null;

function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = window.supabase.createClient(config.url, config.key);
  }
  return supabaseClient;
}

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

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function formatJobTime(value) {
  if (!value) return "";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-TW");
}

function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setMemberCenterVisible(isVisible) {
  if (authFormPanel) authFormPanel.hidden = isVisible;
  if (memberPanel) memberPanel.hidden = !isVisible;
}

function renderProfile(profile = {}) {
  Object.entries(profileFields).forEach(([key, field]) => {
    if (field) field.value = profile[key] || "";
  });
}

function renderMemberSummary(profileData = {}, usageData = {}) {
  if (!memberSummary) return;
  const plan = profileData.plan || "free";
  const email = profileData.email || getAuthEmail();
  const records = Array.isArray(usageData.usage) ? usageData.usage : [];
  const a1A8Record = records.find((record) => record.bucket === "member_a1_a8_monthly") || {};
  const a9Record = records.find((record) => record.bucket === "member_a9_monthly") || {};
  const a1A8Used = Number(a1A8Record.used || 0);
  const a1A8Limit = Number(a1A8Record.limit || 15);
  const a9Used = Number(a9Record.used || 0);
  const a9Limit = Number(a9Record.limit || 3);
  memberSummary.innerHTML = `
    <span>${email || "會員"}</span>
    <span>${plan.toUpperCase()}</span>
    ${hasAdminAccess(profileData) ? `<span>${profileData.is_primary_admin ? "PRIMARY ADMIN" : "ADMIN"}</span>` : ""}
    <span>A1-A8 本月 ${a1A8Used}/${a1A8Limit}</span>
    <span>A9 本月 ${a9Used}/${a9Limit}</span>
  `;
}

function renderUsageList(records = []) {
  if (!usageList) return;
  if (!records.length) {
    usageList.innerHTML = "<span>尚無用量紀錄。註冊會員每月 A1-A8 共用 15 次，A9 可用 3 次。</span>";
    return;
  }
  const bucketLabels = {
    member_a1_a8_monthly: "A1-A8 本月共用額度",
    member_a9_monthly: "A9 本月額度",
    anon_a1_a2_daily: "匿名 A1/A2 今日試用額度",
  };
  usageList.innerHTML = records
    .slice(0, 8)
    .map(
      (record) => `
        <div class="record-item">
          <strong>${bucketLabels[record.bucket] || record.bucket || "使用額度"}</strong>
          <small>${record.used || 0}/${record.limit || 0}，剩餘 ${record.remaining ?? Math.max(0, (record.limit || 0) - (record.used || 0))}</small>
          <small>${record.period || ""}</small>
        </div>
      `,
    )
    .join("");
}

function renderJobList(records = []) {
  if (!jobList) return;
  memberJobs = records;
  if (!records.length) {
    jobList.innerHTML = "<span>尚無任務紀錄。</span>";
    return;
  }
  jobList.innerHTML = records
    .slice(0, 8)
    .map((job, index) => {
      const imageUrls = job.output_images || (job.output_image ? [job.output_image] : []);
      const videoUrls = job.output_videos || (job.output_video ? [job.output_video] : []);
      const hasResult =
        job.status === "completed" && (imageUrls.length || videoUrls.length || job.output_text);
      const downloadUrl = imageUrls[0] || "";
      return `
        <div class="record-item" data-job-index="${index}">
          <strong>${escapeHtml(job.system_id || "AI")} · ${escapeHtml(job.status || "pending")}</strong>
          <small>${escapeHtml(formatJobTime(job.completed_at || job.failed_at || job.created_at) || job.job_id || "")}</small>
          ${job.error ? `<small>${escapeHtml(job.error)}</small>` : ""}
          <div class="record-actions">
            ${
              hasResult
                ? `<button type="button" class="text-button" data-open-job="${index}">查看成果</button>`
                : ""
            }
            ${
              downloadUrl
                ? `<a class="text-button" href="${escapeHtml(downloadUrl)}" download target="_blank" rel="noreferrer">下載</a>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

async function fetchMemberJson(path) {
  const apiBase = getApiBase();
  const token = getAuthToken();
  if (!apiBase || !token) return null;
  const response = await fetch(`${apiBase}${path}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("無法取得會員資料");
  return response.json();
}

async function fetchAdminJson(path, options = {}) {
  const apiBase = getApiBase();
  const token = getAuthToken();
  if (!apiBase || !token) throw new Error("Admin API requires sign in.");
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Admin request failed.");
  }
  return response.json();
}

function setAdminVisible(isVisible) {
  if (adminButton) adminButton.hidden = !isVisible;
  if (memberAdminButton) memberAdminButton.hidden = !isVisible;
}

function hasAdminAccess(profileData = {}) {
  return profileData?.role === "admin" || profileData?.is_primary_admin === true;
}

function renderAdminOverview(data = {}) {
  if (!adminOverview) return;
  const members = data.members || {};
  const jobs = data.jobs || {};
  const usage = data.usage || {};
  const promotionalUsage = usage.member_a1_a8_monthly || {};
  adminOverview.innerHTML = `
    <div class="admin-stat"><span>Total members</span><strong>${members.total || 0}</strong></div>
    <div class="admin-stat"><span>Active</span><strong>${members.by_status?.active || 0}</strong></div>
    <div class="admin-stat"><span>Completed jobs</span><strong>${jobs.completed || 0}</strong></div>
    <div class="admin-stat"><span>A1-A8 usage</span><strong>${promotionalUsage.used || 0}</strong></div>
    <div class="admin-stat admin-stat-wide"><span>Primary admin</span><strong>${escapeHtml(members.primary_admin_email || "not set")}</strong></div>
  `;
}

function renderAdminMembers(records = []) {
  if (!adminMemberList) return;
  if (!records.length) {
    adminMemberList.innerHTML = "<span>No members yet.</span>";
    return;
  }
  adminMemberList.innerHTML = records
    .map((member) => {
      const a1A8 = member.current_usage?.a1_a8 || {};
      const a9 = member.current_usage?.a9 || {};
      const jobs = member.job_summary || {};
      const lastActivity = formatJobTime(jobs.last_activity_at) || "No activity";
      return `
        <div class="admin-member-card" data-admin-email="${escapeHtml(member.email)}">
          <div class="admin-member-identity">
            <strong>${escapeHtml(member.email)}${member.is_primary_admin ? ' <span class="tier-chip">Primary</span>' : ""}</strong>
            <small>${escapeHtml(member.role || "member")} | last login ${escapeHtml(formatJobTime(member.last_login_at) || "never")}</small>
            <div class="admin-usage-summary">
              <span><strong>${Number(a1A8.remaining || 0)}</strong> A1-A8 left this month</span>
              <span><strong>${Number(a9.remaining || 0)}</strong> A9 left this month</span>
              <span><strong>${Number(jobs.completed || 0)}</strong> completed / ${Number(jobs.failed || 0)} failed</span>
              <span>Last activity: ${escapeHtml(lastActivity)}</span>
            </div>
          </div>
          <label>
            Role
            <select data-admin-field="role" ${member.is_primary_admin ? "disabled" : ""}>
              ${["member", "admin"]
                .map((role) => `<option value="${role}" ${member.role === role ? "selected" : ""}>${role}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Plan
            <select data-admin-field="plan">
              ${["free", "plus", "pro", "ultra", "enterprise"]
                .map((plan) => `<option value="${plan}" ${member.plan === plan ? "selected" : ""}>${plan}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Status
            <select data-admin-field="status">
              ${["active", "trialing", "suspended", "banned", "deleted"]
                .map((status) => `<option value="${status}" ${member.status === status ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </label>
          <div class="admin-member-actions">
            <button class="text-button" type="button" data-admin-action="details">Details</button>
            <button class="text-button" type="button" data-admin-action="save">Save</button>
            <button class="text-button" type="button" data-admin-action="grant-package">Open +50 / +5</button>
            <button class="text-button" type="button" data-admin-action="grant-jpg">JPG +10</button>
            <button class="text-button" type="button" data-admin-action="grant-mp4">MP4 +10</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function detailValue(value) {
  const text = String(value || "").trim();
  return escapeHtml(text || "Not provided");
}

function renderAdminMemberDetail(data = {}) {
  if (!adminDetail || !adminDetailContent || !adminDetailTitle) return;
  const member = data.member || {};
  const profile = member.profile || {};
  const usage = Array.isArray(data.usage) ? data.usage : [];
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const credits = Array.isArray(data.credits) ? data.credits : [];
  const currentUsage = data.current_usage || {};
  const a1A8Usage = currentUsage.a1_a8 || {};
  const a9Usage = currentUsage.a9 || {};
  const jobSummary = data.job_summary || {};

  adminDetailTitle.textContent = member.email || "Member";
  adminDetailContent.innerHTML = `
    <div class="admin-detail-summary">
      <div><span>A1-A8 remaining this month</span><strong>${Number(a1A8Usage.remaining || 0)}</strong><small>${Number(a1A8Usage.used || 0)}/${Number(a1A8Usage.limit || 0)} used</small></div>
      <div><span>A9 remaining this month</span><strong>${Number(a9Usage.remaining || 0)}</strong><small>${Number(a9Usage.used || 0)}/${Number(a9Usage.limit || 0)} used</small></div>
      <div><span>Total jobs</span><strong>${Number(jobSummary.total || 0)}</strong><small>${Number(jobSummary.completed || 0)} completed / ${Number(jobSummary.failed || 0)} failed</small></div>
      <div><span>Last activity</span><strong>${detailValue(formatJobTime(jobSummary.last_activity_at))}</strong></div>
    </div>
    <div class="admin-detail-grid">
      <div><span>Name</span><strong>${detailValue(profile.name)}</strong></div>
      <div><span>Company / Studio</span><strong>${detailValue(profile.company)}</strong></div>
      <div><span>Phone</span><strong>${detailValue(profile.phone)}</strong></div>
      <div><span>Tax ID</span><strong>${detailValue(profile.tax_id)}</strong></div>
      <div><span>Invoice title</span><strong>${detailValue(profile.invoice_title)}</strong></div>
      <div><span>Profession / Role</span><strong>${detailValue(profile.profession)}</strong></div>
      <div><span>Registered</span><strong>${detailValue(formatJobTime(member.created_at))}</strong></div>
      <div><span>Last login</span><strong>${detailValue(formatJobTime(member.last_login_at))}</strong></div>
      <div><span>Plan</span><strong>${detailValue(member.plan)}</strong></div>
      <div><span>Status</span><strong>${detailValue(member.status)}</strong></div>
    </div>
    <div class="admin-detail-sections">
      <section>
        <h4>Usage</h4>
        <div class="record-list">
          ${
            usage.length
              ? usage
                  .slice(0, 12)
                  .map(
                    (record) => `
                      <div class="record-item">
                        <strong>${detailValue(record.bucket)}</strong>
                        <small>${Number(record.used || 0)}/${Number(record.limit || 0)} | ${detailValue(record.period)}</small>
                      </div>
                    `,
                  )
                  .join("")
              : "<span>No usage records.</span>"
          }
        </div>
      </section>
      <section>
        <h4>Recent jobs</h4>
        <div class="record-list">
          ${
            jobs.length
              ? jobs
                  .slice(0, 12)
                  .map(
                    (job) => `
                      <div class="record-item">
                        <strong>${detailValue(job.system_id)} | ${detailValue(job.status)}</strong>
                        <small>${detailValue(formatJobTime(job.completed_at || job.failed_at || job.created_at))}</small>
                        ${job.error ? `<small>${detailValue(job.error)}</small>` : ""}
                      </div>
                    `,
                  )
                  .join("")
              : "<span>No job records.</span>"
          }
        </div>
      </section>
      <section>
        <h4>Credits and grants</h4>
        <div class="record-list">
          ${
            credits.length
              ? credits
                  .slice(0, 12)
                  .map(
                    (entry) => `
                      <div class="record-item">
                        <strong>+${Number(entry.amount || 0)} ${detailValue(entry.bucket)}</strong>
                        <small>${detailValue(entry.reason)} | ${detailValue(formatJobTime(entry.created_at))}</small>
                      </div>
                    `,
                  )
                  .join("")
              : "<span>No credit records.</span>"
          }
        </div>
      </section>
    </div>
  `;
  adminDetail.hidden = false;
  adminDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadAdminMemberDetail(email) {
  if (adminMessage) adminMessage.textContent = `Loading ${email}...`;
  const data = await fetchAdminJson(`/api/admin/members/${encodeURIComponent(email)}`);
  renderAdminMemberDetail(data);
  if (adminMessage) adminMessage.textContent = "Member detail loaded.";
}

async function loadAdminDashboard() {
  if (!adminMessage) return;
  adminMessage.textContent = "Loading admin data...";
  if (adminDetail) adminDetail.hidden = true;
  try {
    const [overview, members] = await Promise.all([
      fetchAdminJson("/api/admin/overview"),
      fetchAdminJson("/api/admin/members"),
    ]);
    renderAdminOverview(overview);
    renderAdminMembers(members.members || []);
    adminMessage.textContent = "Admin data loaded.";
  } catch (error) {
    adminMessage.textContent = error.message || "Admin data failed to load.";
  }
}

async function handleAdminMemberAction(event) {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const card = button.closest("[data-admin-email]");
  if (!card) return;
  const email = card.dataset.adminEmail;
  const action = button.dataset.adminAction;
  button.disabled = true;
  if (adminMessage) adminMessage.textContent = "Saving admin change...";

  try {
    if (action === "details") {
      await loadAdminMemberDetail(email);
    } else if (action === "save") {
      const payload = {
        role: card.querySelector('[data-admin-field="role"]')?.value,
        plan: card.querySelector('[data-admin-field="plan"]')?.value,
        status: card.querySelector('[data-admin-field="status"]')?.value,
      };
      await fetchAdminJson(`/api/admin/members/${encodeURIComponent(email)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else if (action === "grant-package") {
      await fetchAdminJson(`/api/admin/members/${encodeURIComponent(email)}/grant-package`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Promotional access opened by admin",
        }),
      });
    } else if (action === "grant-jpg" || action === "grant-mp4") {
      const isJpgGrant = action === "grant-jpg";
      await fetchAdminJson(`/api/admin/members/${encodeURIComponent(email)}/grant`, {
        method: "POST",
        body: JSON.stringify({
          bucket: isJpgGrant ? "member_a1_a8_monthly" : "member_a9_monthly",
          amount: 10,
          reason: isJpgGrant ? "JPG +10 granted by admin" : "MP4 +10 granted by admin",
        }),
      });
    }
    if (action !== "details") await loadAdminDashboard();
  } catch (error) {
    if (adminMessage) adminMessage.textContent = error.message || "Admin change failed.";
  } finally {
    button.disabled = false;
  }
}

async function loadMemberCenter() {
  const email = getAuthEmail();
  setMemberCenterVisible(Boolean(email));
  setAdminVisible(false);
  currentMember = null;
  if (!email || !getApiBase()) return;

  try {
    const [profileData, usageData, jobsData] = await Promise.all([
      fetchMemberJson("/api/member/profile"),
      fetchMemberJson("/api/member/usage"),
      fetchMemberJson("/api/member/jobs"),
    ]);
    currentMember = profileData || null;
    setAdminVisible(hasAdminAccess(profileData));
    renderProfile(profileData?.profile || {});
    renderMemberSummary(profileData || {}, usageData || {});
    renderUsageList(usageData?.usage || []);
    renderJobList(jobsData?.jobs || []);
  } catch (error) {
    if (authMessage) authMessage.textContent = `${error.message}，請稍後再試。`;
  }
}

function updateAuthUi() {
  const email = getAuthEmail();
  if (authButton) authButton.textContent = email ? "會員中心" : "登入";
  if (!email) setAdminVisible(false);
  setMemberCenterVisible(Boolean(email));
  if (authMessage) {
    authMessage.textContent = email
      ? `已登入：${email}`
      : hasSupabaseConfig()
        ? "請使用 Email 註冊或登入；註冊後需完成信箱驗證。"
        : "尚未設定 Supabase，會員驗證功能尚未啟用。";
  }
}

async function refreshAuthSession() {
  const client = getSupabaseClient();
  if (!client) return;
  const { data } = await client.auth.getSession();
  const session = data?.session;
  if (session?.access_token) {
    localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
    localStorage.setItem(AUTH_EMAIL_KEY, session.user?.email || "");
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
  }
  updateAuthUi();
  await loadMemberCenter();
}

function handleAuthCallbackError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const description = params.get("error_description") || "";
  if (!error) return;

  const isMissingState = description.toLowerCase().includes("state parameter missing");
  authMessage.textContent = isMissingState
    ? "Google 登入流程已過期，請重新按「使用 Google 帳號繼續」。"
    : `登入失敗：${description || error}`;
  if (!authDialog.open) authDialog.showModal();

  ["error", "error_code", "error_description"].forEach((key) => params.delete(key));
  const cleanQuery = params.toString();
  const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function requiresMember(system) {
  return !["A1", "A2"].includes(system.id);
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
    <span class="system-id">${system.displayId || system.id}</span>
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
      <span class="system-id">${system.gridDisplayId || system.displayId || system.id}</span>
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

const A9_HORIZONTAL_PROMPT =
  "(Camera moving from left to right:1.5), shooting clockwise around a horizontal plane. A cinematic aerial drone captures a sunset over a  building. The view sweeps steadily to the right, revealing the right side of the building structure. The background blurs as the camera circles in a clockwise arc. Golden hour lighting, high-speed motion blur on surroundings, building remains sharp and centered. Architectural consistency, stable geometry, 4k, professional advertising style.";
const A9_FLY_AROUND_PROMPT =
  "Stable drone shot, flying around the skyscraper complex, smooth sweeping cinematic arc movement, breathtaking architectural perspective.";
const A9_ORBIT_PROMPT =
  "Smooth architectural camera orbit around the building corner, locking focus on the structure, parallax effect, flawless vertical lines.";

const A9_PROMPT_PRESETS = {
  horizontal: A9_HORIZONTAL_PROMPT,
  "fly-around": A9_FLY_AROUND_PROMPT,
  orbit: A9_ORBIT_PROMPT,
};

function textPromptField(system) {
  const wrapper = document.createElement("div");
  wrapper.className = "field-box";
  const isA9 = system.id === "A9-1";
  wrapper.innerHTML = `
    <label for="customPrompt">${isA9 ? "影像提示詞" : "建築提示詞"}</label>
    <textarea id="customPrompt" placeholder="${
      isA9
        ? "描述鏡頭方向、運動方式、光線與動畫氛圍..."
        : "例如：低樓層集合住宅、清水混凝土、深窗框、街角基地、柔和日光..."
    }"></textarea>
    ${
      isA9
        ? `
          <div class="prompt-presets" aria-label="推薦提示詞">
            <span>推薦提示詞</span>
            <button type="button" data-prompt-preset="horizontal">1. 水平移動</button>
            <button type="button" data-prompt-preset="fly-around">2. Fly Around（航拍大範圍透視）</button>
            <button type="button" data-prompt-preset="orbit">3. Orbit（建築環繞／3D 透視）</button>
            <button type="button" disabled>4. 待更新</button>
            <button type="button" disabled>5. 待更新</button>
          </div>
        `
        : ""
    }
  `;
  wrapper.querySelectorAll("[data-prompt-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      wrapper.querySelector("#customPrompt").value = A9_PROMPT_PRESETS[button.dataset.promptPreset] || "";
    });
  });
  return wrapper;
}

function countField() {
  const wrapper = document.createElement("div");
  wrapper.className = "field-box";
  wrapper.innerHTML = `
    <label for="outputCount">輸出張數</label>
    <select id="outputCount">
      <option>1 View - Quick Test</option>
      <option>6 Views - Design Exploration</option>
    </select>
  `;
  return wrapper;
}

function renderInputs(system) {
  inputStack.innerHTML = "";
  inputStack.classList.toggle("multi-image-inputs", system.inputs.length >= 4);
  system.inputs.forEach((input) => inputStack.append(uploadField(input)));
  if (system.prompt) inputStack.append(textPromptField(system));
  if (system.count) inputStack.append(countField());

  const generateButton = document.createElement("button");
  generateButton.className = "generate-button";
  generateButton.type = "button";
  generateButton.textContent =
    system.result === "prompt"
      ? "產生提示詞"
      : system.result === "video"
        ? "AI製作影片"
        : "產生建築圖";
  generateButton.addEventListener("click", submitOrSimulateGenerate);
  inputStack.append(generateButton);

  const usageNotice = document.createElement("p");
  usageNotice.className = "generation-notice";
  usageNotice.innerHTML =
    'AI 成果僅供提案、設計討論與概念視覺化，可能有錯誤或變形，送出前請確認素材權利，使用與公開發布前請自行檢查。<a href="#usage-notice">查看完整使用須知</a>';
  inputStack.append(usageNotice);
}

function renderResult(system) {
  activeResultUrl = "";
  activeResultType = "";
  activeResultBlob = null;
  activeResultBlobPromise = null;
  const isPrompt = system.result === "prompt";
  resultTitle.textContent = isPrompt
    ? "提示詞結果"
    : system.result === "video"
      ? "AI演算影像結果"
      : "建築圖結果";
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
  if (!system.count) return;

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

function getOriginalPreview(system) {
  return system.inputs
    .map((input) => previews.get(`${system.id}-${input.key}`))
    .find(Boolean);
}

function setComparisonResult(originalUrl, resultUrl) {
  activeResultUrl = resultUrl;
  activeResultType = "image";
  prepareResultBlob(resultUrl);
  mainPreview.innerHTML = `
    <div class="image-compare">
      <img src="${originalUrl}" alt="處理前圖片" />
      <div class="image-compare-after">
        <img src="${resultUrl}" alt="處理後圖片" />
      </div>
      <div class="image-compare-line" aria-hidden="true"></div>
      <span class="image-compare-label before">處理前</span>
      <span class="image-compare-label after">處理後</span>
      <input type="range" min="0" max="100" value="50" aria-label="拖曳比較處理前後圖片" />
    </div>
  `;
  const comparison = mainPreview.querySelector(".image-compare");
  comparison.querySelector("input").addEventListener("input", (event) => {
    comparison.style.setProperty("--compare-position", `${event.target.value}%`);
  });
  thumbGrid.innerHTML = "";
}

function setImageResults(imageUrls) {
  if (!imageUrls.length) {
    activeResultUrl = "";
    activeResultType = "";
    activeResultBlob = null;
    activeResultBlobPromise = null;
    mainPreview.innerHTML = "<span>任務完成，但沒有收到可顯示的成果圖。</span>";
    return;
  }

  activeResultUrl = imageUrls[0];
  activeResultType = "image";
  prepareResultBlob(imageUrls[0]);
  mainPreview.innerHTML = `<img src="${imageUrls[0]}" alt="AI render result" />`;
  thumbGrid.innerHTML = "";
  imageUrls.forEach((imageUrl, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<img src="${imageUrl}" alt="Result ${index + 1}" />`;
    button.addEventListener("click", () => {
      activeResultUrl = imageUrl;
      activeResultType = "image";
      prepareResultBlob(imageUrl);
      mainPreview.innerHTML = `<img src="${imageUrl}" alt="AI render result" />`;
    });
    thumbGrid.append(button);
  });
}

function setVideoResults(videoUrls) {
  if (!videoUrls.length) {
    activeResultUrl = "";
    activeResultType = "";
    activeResultBlob = null;
    activeResultBlobPromise = null;
    mainPreview.innerHTML = "<span>任務完成，但沒有收到可播放的影片。</span>";
    thumbGrid.innerHTML = "";
    return;
  }

  activeResultUrl = videoUrls[0];
  activeResultType = "video";
  prepareResultBlob(videoUrls[0]);
  mainPreview.innerHTML = `
    <video controls playsinline preload="metadata">
      <source src="${videoUrls[0]}" />
      您的瀏覽器無法播放此影片。
    </video>
  `;
  thumbGrid.innerHTML = "";
}

function setJobResults(system, job) {
  if (system.result === "video") {
    setVideoResults(job.output_videos || (job.output_video ? [job.output_video] : []));
    return;
  }
  const imageUrls = job.output_images || (job.output_image ? [job.output_image] : []);
  const originalUrl = getOriginalPreview(system);
  if (["A8-1", "A8-2"].includes(system.id) && originalUrl && imageUrls[0]) {
    setComparisonResult(originalUrl, imageUrls[0]);
    return;
  }
  setImageResults(imageUrls);
}

function openJobResult(index) {
  const job = memberJobs[index];
  if (!job) return;
  const system = systems.find((item) => item.id === job.system_id) || getActiveSystem();
  activeId = system.id;
  renderApp();

  if (system.result === "prompt") {
    promptOutput.textContent = job.output_text || "此任務沒有提示詞內容。";
  } else {
    setJobResults(system, job);
  }

  document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  authDialog.close();
}

function renderJobProgress(system, job = {}) {
  const percent = Math.max(1, Math.min(Number(job.progress_percent || 8), 99));
  const activeStage = job.stage || "analyzing";
  const stageOrder = ["analyzing", "encoding", "generating", "uploading"];
  const activeIndex = Math.max(0, stageOrder.indexOf(activeStage));
  const stages = [
    ["analyzing", "分析使用者提供資訊"],
    ["encoding", "影像編碼中"],
    ["generating", "影像生成中"],
    ["uploading", "成果整理與上傳中"],
  ];
  const markup = `
    <div class="job-progress">
      <div class="job-progress-header">
        <strong>${escapeHtml(job.stage_label || "分析使用者提供資訊")}</strong>
        <span>預估 ${percent}%</span>
      </div>
      <div class="job-progress-track" aria-label="預估作業進度">
        <span style="width: ${percent}%"></span>
      </div>
      <ol class="job-progress-stages">
        ${stages
          .map(
            ([key, label], index) => `
              <li class="${index < activeIndex ? "done" : index === activeIndex ? "active" : ""}">
                <span>${index + 1}</span>${label}
              </li>
            `,
          )
          .join("")}
      </ol>
      <small>通常約 2-6 分鐘，繁忙或複雜任務可能更久。百分比為預估，完成後會自動顯示成果。</small>
    </div>
  `;
  if (system.result === "prompt") {
    promptOutput.innerHTML = markup;
  } else {
    mainPreview.innerHTML = markup;
    thumbGrid.innerHTML = "";
  }
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
        setJobResults(system, job);
      }
      return;
    }

    if (job.status === "failed") {
      throw new Error(job.error || "任務失敗");
    }

    renderJobProgress(system, job);
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
    authMessage.textContent = "請先登入會員後再使用 A3-A9。";
    authDialog.showModal();
    throw new Error("請先登入會員後再使用 A3-A9");
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
  renderJobProgress(system, {
    stage: "analyzing",
    stage_label: "分析使用者提供資訊",
    progress_percent: 8,
  });

  await pollJob(data.job_id, system);
  await loadMemberCenter();
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
  systems
    .filter((item) => !["A8-2", "A9-2"].includes(item.id))
    .forEach((item) => systemsGrid.append(systemCard(item)));

  activeTier.textContent = `${system.tier} Access`;
  activeTitle.textContent =
    system.activeTitle || `${system.displayId || system.id} ${system.title}`;
  activeDesc.textContent = system.desc;
  activeStatus.textContent = system.status;
  activeStatus.classList.toggle("pending", system.status !== "Live System");

  renderInputs(system);
  renderResult(system);
}

async function convertImageBlobToPng(blob) {
  if (blob.type === "image/png") return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (pngBlob) => (pngBlob ? resolve(pngBlob) : reject(new Error("PNG conversion failed"))),
      "image/png",
    );
  });
}

$("#copyResult").addEventListener("click", async () => {
  const system = getActiveSystem();
  const button = $("#copyResult");
  button.disabled = true;

  try {
    if (system.result === "prompt") {
      await navigator.clipboard.writeText(promptOutput.textContent.trim());
      button.textContent = "Copied";
      return;
    }

    if (!activeResultUrl) {
      button.textContent = "No result";
      return;
    }

    if (activeResultType === "image" && window.ClipboardItem && navigator.clipboard.write) {
      const response = await fetch(activeResultUrl);
      if (!response.ok) throw new Error(`Copy failed: ${response.status}`);
      const pngBlob = await convertImageBlobToPng(await response.blob());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      button.textContent = "Image copied";
      return;
    }

    await navigator.clipboard.writeText(activeResultUrl);
    button.textContent = activeResultType === "video" ? "Video link copied" : "Link copied";
  } catch {
    try {
      if (activeResultUrl) {
        await navigator.clipboard.writeText(activeResultUrl);
        button.textContent = "Link copied";
      } else {
        button.textContent = "Copy failed";
      }
    } catch {
      button.textContent = "Copy failed";
    }
  } finally {
    button.disabled = false;
    window.setTimeout(() => (button.textContent = "Copy"), 1800);
  }
});

function getResultExtension(url, type) {
  try {
    const extension = new URL(url, window.location.href).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
    if (extension) return extension.toLowerCase();
  } catch {
    // Use a sensible default when the result URL cannot be parsed.
  }
  return type === "video" ? "mp4" : "png";
}

function getBlobExtension(blob, url, type) {
  const extensionsByMimeType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return extensionsByMimeType[blob.type.split(";")[0]] || getResultExtension(url, type);
}

function prepareResultBlob(url) {
  activeResultBlob = null;
  activeResultBlobPromise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return response.blob();
    })
    .then((blob) => {
      if (!blob.size) throw new Error("Downloaded result is empty");
      if (blob.type.startsWith("text/")) throw new Error("Downloaded result is not media");
      if (url === activeResultUrl) activeResultBlob = blob;
      return blob;
    })
    .catch(() => null);
}

function getSavePickerTypes(type, extension, mimeType) {
  const description = type === "video" ? "影片檔案" : type === "image" ? "圖片檔案" : "文字檔案";
  return [{
    description,
    accept: {
      [mimeType.split(";")[0]]: [`.${extension}`],
    },
  }];
}

async function chooseSaveHandle(filename, type, extension, mimeType) {
  if (!window.isSecureContext || !window.showSaveFilePicker) {
    throw new Error("SAVE_PICKER_UNSUPPORTED");
  }
  return window.showSaveFilePicker({
    suggestedName: filename,
    types: getSavePickerTypes(type, extension, mimeType),
  });
}

async function saveBlob(blob, handle) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!bytes.byteLength) throw new Error("Result file is empty");

  const writable = await handle.createWritable();
  await writable.write({
    type: "write",
    position: 0,
    data: bytes,
  });
  await writable.truncate(bytes.byteLength);
  await writable.close();

  const savedFile = await handle.getFile();
  if (savedFile.size !== bytes.byteLength) {
    throw new Error(`Saved file size mismatch: ${savedFile.size}/${bytes.byteLength}`);
  }
}

$("#downloadResult").addEventListener("click", async () => {
  const system = getActiveSystem();
  const button = $("#downloadResult");
  const filenameBase = `${activeId.toLowerCase()}-architect-ai-result`;

  if (system.result === "prompt") {
    const blob = new Blob([promptOutput.textContent.trim()], { type: "text/plain;charset=utf-8" });
    button.disabled = true;
    button.textContent = "Choose location...";
    try {
      const filename = `${filenameBase}.txt`;
      const handle = await chooseSaveHandle(filename, "text", "txt", "text/plain");
      await saveBlob(blob, handle);
      button.textContent = "Saved";
    } catch (error) {
      button.textContent =
        error?.name === "AbortError"
          ? "Cancelled"
          : error?.message === "SAVE_PICKER_UNSUPPORTED"
            ? "Use Edge / Chrome"
            : "Save failed";
    } finally {
      button.disabled = false;
      window.setTimeout(() => (button.textContent = "Save"), 1800);
    }
    return;
  }

  if (!activeResultUrl) {
    button.textContent = "No result";
    window.setTimeout(() => (button.textContent = "Save"), 1600);
    return;
  }

  if (!activeResultBlob) {
    button.disabled = true;
    button.textContent = "Preparing...";
    const blob = await activeResultBlobPromise;
    button.disabled = false;
    button.textContent = blob?.size ? "Ready - click Save" : "Save failed";
    window.setTimeout(() => (button.textContent = "Save"), 2400);
    return;
  }

  button.textContent = "Saving...";
  button.disabled = true;
  const extension = getBlobExtension(activeResultBlob, activeResultUrl, activeResultType);
  const filename = `${filenameBase}.${extension}`;

  try {
    button.textContent = "Choose location...";
    const fallbackMimeType = activeResultType === "video" ? "video/mp4" : "image/png";
    const handle = await chooseSaveHandle(
      filename,
      activeResultType,
      extension,
      activeResultBlob.type || fallbackMimeType,
    );
    button.textContent = "Saving...";
    await saveBlob(activeResultBlob, handle);
    button.textContent = "Saved";
  } catch (error) {
    button.textContent =
      error?.name === "AbortError"
        ? "Cancelled"
        : error?.message === "SAVE_PICKER_UNSUPPORTED"
          ? "Use Edge / Chrome"
          : "Save failed";
  } finally {
    button.disabled = false;
    window.setTimeout(() => (button.textContent = "Save"), 1800);
  }
});

const authDialog = $("#authDialog");
document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => authDialog.showModal());
});

async function loginWithEmail() {
  const email = authEmail?.value.trim();
  const password = authPassword?.value || "";
  if (!email) {
    authMessage.textContent = "請輸入 Email。";
    return;
  }

  if (!password) {
    authMessage.textContent = "請輸入密碼。";
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    authMessage.textContent = "尚未設定 Supabase，無法使用正式會員登入。";
    return;
  }

  authSubmit.disabled = true;
  authMessage.textContent = "登入中...";

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    localStorage.setItem(AUTH_TOKEN_KEY, data.session.access_token);
    localStorage.setItem(AUTH_EMAIL_KEY, data.user?.email || email);
    updateAuthUi();
    await loadMemberCenter();
    authDialog.close();
  } catch (error) {
    authMessage.textContent = error.message || "登入失敗";
  } finally {
    authSubmit.disabled = false;
  }
}

async function registerWithEmail() {
  const email = authEmail?.value.trim();
  const password = authPassword?.value || "";
  if (!email) {
    authMessage.textContent = "請輸入 Email。";
    return;
  }
  if (password.length < 8) {
    authMessage.textContent = "密碼至少需要 8 個字元。";
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    authMessage.textContent = "尚未設定 Supabase，無法註冊正式會員。";
    return;
  }

  authRegister.disabled = true;
  authMessage.textContent = "註冊中...";

  try {
    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    authMessage.textContent = "註冊成功，請到信箱收驗證信。完成驗證後再登入。";
  } catch (error) {
    authMessage.textContent = error.message || "註冊失敗";
  } finally {
    authRegister.disabled = false;
  }
}

async function resetPassword() {
  const email = authEmail?.value.trim();
  if (!email) {
    authMessage.textContent = "請先輸入 Email。";
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    authMessage.textContent = "尚未設定 Supabase，無法寄送重設密碼信。";
    return;
  }

  authMessage.textContent = "寄送重設密碼信...";
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  authMessage.textContent = error ? error.message : "已寄送重設密碼信，請檢查信箱。";
}

async function loginWithGoogle() {
  const client = getSupabaseClient();
  if (!client) {
    authMessage.textContent = "尚未設定 Supabase，無法使用 Google 登入。";
    return;
  }

  authGoogle.disabled = true;
  authMessage.textContent = "正在前往 Google 登入...";
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",
    },
  });
  if (error) {
    authMessage.textContent = error.message || "Google 登入啟動失敗，請稍後再試。";
    authGoogle.disabled = false;
  }
}

async function signOut() {
  const client = getSupabaseClient();
  if (client) await client.auth.signOut();
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
  currentMember = null;
  setAdminVisible(false);
  renderProfile({});
  renderUsageList([]);
  renderJobList([]);
  updateAuthUi();
  if (authMessage) authMessage.textContent = "已登出，A3-A9 需重新登入後使用。";
}

async function saveProfile(event) {
  event.preventDefault();
  const apiBase = getApiBase();
  const token = getAuthToken();
  if (!apiBase || !token) {
    authMessage.textContent = "請先登入會員後再儲存資料。";
    return;
  }

  const payload = Object.fromEntries(
    Object.entries(profileFields).map(([key, field]) => [key, field?.value || ""]),
  );

  try {
    const response = await fetch(`${apiBase}/api/member/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("會員資料儲存失敗");
    authMessage.textContent = "會員資料已儲存。";
    await loadMemberCenter();
  } catch (error) {
    authMessage.textContent = error.message || "會員資料儲存失敗";
  }
}

authSubmit?.addEventListener("click", loginWithEmail);
authRegister?.addEventListener("click", registerWithEmail);
authReset?.addEventListener("click", resetPassword);
authGoogle?.addEventListener("click", loginWithGoogle);
authSignOut?.addEventListener("click", signOut);
async function openAdminDialog() {
  adminDialog?.showModal();
  await loadAdminDashboard();
}

adminButton?.addEventListener("click", openAdminDialog);
memberAdminButton?.addEventListener("click", openAdminDialog);
adminRefresh?.addEventListener("click", loadAdminDashboard);
adminMemberList?.addEventListener("click", handleAdminMemberAction);
adminDetailClose?.addEventListener("click", () => {
  if (adminDetail) adminDetail.hidden = true;
});
profileForm?.addEventListener("submit", saveProfile);
jobList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-job]");
  if (!button) return;
  openJobResult(Number(button.dataset.openJob));
});
authEmail?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loginWithEmail();
  }
});
authPassword?.addEventListener("keydown", (event) => {
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
refreshAuthSession().finally(handleAuthCallbackError);
getSupabaseClient()?.auth.onAuthStateChange(async (event, session) => {
  if (session?.access_token) {
    localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
    localStorage.setItem(AUTH_EMAIL_KEY, session.user?.email || "");
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
  }
  updateAuthUi();
  await loadMemberCenter();
  if (event === "SIGNED_IN" && authDialog?.open) authDialog.close();
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.scrollTarget);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 78;
    window.scrollTo({ top, behavior: "smooth" });
  });
});

renderApp();
