// Existing member operations, shared by the standalone admin workspace.
export function mountMembers(host, { request, readProfile }) {
  const find = id => host.querySelector('#' + id);
  const adminMessage = find('adminMessage'), adminOverview = find('adminOverview');
  const adminMemberList = find('adminMemberList'), adminDetail = find('adminDetail');
  const adminDetailTitle = find('adminDetailTitle'), adminDetailContent = find('adminDetailContent');
  const refreshButton = find('adminRefresh');
  let listRevision = 0, detailRevision = 0, loaded = false;
  const busyCards = new WeakSet();
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const formatJobTime = value => {
    if (!value) return '';
    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-TW');
  };
function renderAdminOverview(data = {}) {
  if (!adminOverview) return;
  const members = data.members || {};
  const jobs = data.jobs || {};
  const usage = data.usage || {};
  const promotionalUsage = usage.member_a1_a8_monthly || {};
  adminOverview.innerHTML = `
    <div class="admin-stat"><span>會員總數</span><strong>${Number(members.total || 0)}</strong></div>
    <div class="admin-stat"><span>啟用帳號</span><strong>${Number(members.by_status?.active || 0)}</strong></div>
    <div class="admin-stat"><span>完成任務</span><strong>${Number(jobs.completed || 0)}</strong></div>
    <div class="admin-stat"><span>A1-A8 使用次數</span><strong>${Number(promotionalUsage.used || 0)}</strong></div>
    <div class="admin-stat admin-stat-wide"><span>主要管理員</span><strong>${escapeHtml(members.primary_admin_email || "not set")}</strong></div>
  `;
}

function renderAdminMembers(records = []) {
  if (!adminMemberList) return;
  if (!records.length) {
    adminMemberList.innerHTML = "<span>尚無會員。</span>";
    return;
  }
  adminMemberList.innerHTML = records
    .map((member) => {
      const a1A8 = member.current_usage?.a1_a8 || {};
      const a9 = member.current_usage?.a9 || {};
      const a10 = member.current_usage?.a10 || {};
      const jobs = member.job_summary || {};
      const lastActivity = formatJobTime(jobs.last_activity_at) || "尚無活動";
      return `
        <div class="admin-member-card" data-admin-email="${escapeHtml(member.email)}">
          <div class="admin-member-identity">
            <strong>${escapeHtml(member.email)}${member.is_primary_admin ? ' <span class="tier-chip">Primary</span>' : ""}</strong>
            <small>${escapeHtml(member.role || "member")} | 最近登入 ${escapeHtml(formatJobTime(member.last_login_at) || "尚未登入")}</small>
            <div class="admin-usage-summary">
              <span><strong>${Number(a1A8.remaining || 0)}</strong> A1-A8 本月剩餘</span>
              <span><strong>${Number(a9.remaining || 0)}</strong> A9 本月剩餘</span>
              <span><strong>${Number(a10.remaining || 0)}</strong> A10 獨立額度</span>
              <span><strong>${Number(jobs.completed || 0)}</strong> 完成 / ${Number(jobs.failed || 0)} 失敗</span>
              <span>最近活動： ${escapeHtml(lastActivity)}</span>
            </div>
          </div>
          <label>
            角色
            <select data-admin-field="role" ${member.is_primary_admin ? "disabled" : ""}>
              ${["member", "admin"]
                .map((role) => `<option value="${role}" ${member.role === role ? "selected" : ""}>${role}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            方案
            <select data-admin-field="plan">
              ${["free", "plus", "pro", "ultra", "enterprise"]
                .map((plan) => `<option value="${plan}" ${member.plan === plan ? "selected" : ""}>${plan}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            狀態
            <select data-admin-field="status">
              ${["active", "trialing", "suspended", "banned", "deleted"]
                .map((status) => `<option value="${status}" ${member.status === status ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </label>
          <label>全功能開通
            <input type="checkbox" data-full-access ${member.full_feature_access ? "checked" : ""} ${!readProfile()?.can_manage_full_features || member.email === "zheng08026@gmail.com" ? "disabled" : ""}>
            <button type="button" class="text-button" data-admin-action="full-access" ${!readProfile()?.can_manage_full_features || member.email === "zheng08026@gmail.com" ? "disabled" : ""}>儲存開通設定</button>
          </label>
          <div class="admin-member-actions">
            <button class="text-button" type="button" data-admin-action="details">查看明細</button>
            <button class="text-button" type="button" data-admin-action="save">儲存帳號設定</button>
            <button class="text-button" type="button" data-admin-action="grant-package">追加 +50 / +5</button>
            <button class="text-button" type="button" data-admin-action="grant-jpg">JPG +10</button>
            <button class="text-button" type="button" data-admin-action="grant-mp4">MP4 +10</button>
            <button class="text-button" type="button" data-admin-action="grant-a10">A10 +10</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function detailValue(value) {
  const text = String(value || "").trim();
  return escapeHtml(text || "未提供");
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
      <div><span>Total jobs</span><strong>${Number(jobSummary.total || 0)}</strong><small>${Number(jobSummary.completed || 0)} 完成 / ${Number(jobSummary.failed || 0)} 失敗</small></div>
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
              : "<span>尚無用量紀錄。</span>"
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
              : "<span>尚無任務紀錄。</span>"
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
              : "<span>尚無額度紀錄。</span>"
          }
        </div>
      </section>
    </div>
  `;
  adminDetail.hidden = false;
  adminDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}


  async function load() {
    const version = ++listRevision;
    detailRevision++;
    adminMessage.textContent = '正在讀取會員資料…';
    refreshButton.disabled = true;
    adminDetail.hidden = true;
    try {
      const [overview, members] = await Promise.all([request('/api/admin/overview'), request('/api/admin/members')]);
      if (version !== listRevision) return;
      renderAdminOverview(overview);
      renderAdminMembers(members.members || []);
      loaded = true;
      adminMessage.textContent = '會員資料已更新。';
    } catch (error) {
      if (!error.stale && version === listRevision && readProfile()) adminMessage.textContent = error.message || '會員資料載入失敗，請稍後重試。';
    } finally { if (version === listRevision) refreshButton.disabled = false; }
  }
  async function detail(email) {
    const version = ++detailRevision;
    adminMessage.textContent = '正在讀取會員明細…';
    const data = await request(`/api/admin/members/${encodeURIComponent(email)}`);
    if (version !== detailRevision) return;
    renderAdminMemberDetail(data);
    adminMessage.textContent = '會員明細已載入。';
  }
  async function action(event) {
    const button = event.target.closest('[data-admin-action]');
    const card = button?.closest('[data-admin-email]');
    if (!card || !readProfile() || busyCards.has(card)) return;
    const email = card.dataset.adminEmail, kind = button.dataset.adminAction;
    const version = listRevision;
    busyCards.add(card); button.disabled = true;
    adminMessage.textContent = kind === 'details' ? '正在讀取會員明細…' : '正在儲存變更…';
    try {
      const path = `/api/admin/members/${encodeURIComponent(email)}`;
      if (kind === 'details') await detail(email);
      else if (kind === 'full-access') {
        if (!readProfile()?.can_manage_full_features || email === 'zheng08026@gmail.com') return;
        await request(path + '/full-access', {method:'PATCH', body:JSON.stringify({enabled:card.querySelector('[data-full-access]').checked})});
      } else if (kind === 'save') {
        const payload = Object.fromEntries(['role','plan','status'].map(name => [name, card.querySelector(`[data-admin-field="${name}"]`).value]));
        await request(path, {method:'PATCH', body:JSON.stringify(payload)});
      } else if (kind === 'grant-package') {
        await request(path + '/grant-package', {method:'POST',body:JSON.stringify({reason:'Promotional access opened by admin'})});
      } else if (['grant-a10','grant-jpg','grant-mp4'].includes(kind)) {
        const bucket = kind === 'grant-a10' ? 'member_a10_lifetime' : kind === 'grant-jpg' ? 'member_a1_a8_monthly' : 'member_a9_monthly';
        const reason = kind === 'grant-a10' ? 'A10 independent credits granted by admin' : kind === 'grant-jpg' ? 'JPG +10 granted by admin' : 'MP4 +10 granted by admin';
        await request(path + '/grant', {method:'POST',body:JSON.stringify({bucket,amount:10,reason})});
      } else return;
      if (kind !== 'details' && version === listRevision && readProfile()) await load();
    } catch (error) {
      if (!error.stale && version === listRevision && readProfile()) adminMessage.textContent = error.message || '操作失敗，請稍後再試。';
    } finally { busyCards.delete(card); button.disabled = false; }
  }
  function clear() {
    listRevision++; detailRevision++; loaded = false;
    adminMessage.textContent = '';
    adminOverview.replaceChildren(); adminMemberList.replaceChildren();
    adminDetail.hidden = true; adminDetailContent.replaceChildren(); adminDetailTitle.textContent = '會員明細';
    refreshButton.disabled = false;
  }
  refreshButton.addEventListener('click', load);
  adminMemberList.addEventListener('click', action);
  find('adminDetailClose').addEventListener('click', () => { detailRevision++; adminDetail.hidden = true; });
  function updatePermissions() {
    for (const card of adminMemberList.querySelectorAll('[data-admin-email]')) {
      const disabled = !readProfile()?.can_manage_full_features || card.dataset.adminEmail === 'zheng08026@gmail.com';
      card.querySelector('[data-full-access]').disabled = disabled;
      card.querySelector('[data-admin-action="full-access"]').disabled = disabled;
    }
  }
  return { load, clear, updatePermissions, get loaded() { return loaded; } };
}
