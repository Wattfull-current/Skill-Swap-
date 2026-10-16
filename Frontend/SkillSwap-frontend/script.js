// ═══════════════════════════════════════════════════
const API = (window.API_CONFIG && window.API_CONFIG.BASE_URL)
  ? window.API_CONFIG.BASE_URL
  : 'http://localhost:3000';

const PREDEFINED_SKILLS = [
  'Data Analysis', 'Coding (Python)', 'Data Visualization (Tableau, Power BI)',
  'Coding (JavaScript)', 'Project Management', 'HTML & CSS',
  'Agile & Scrum Methodologies', 'SQL & Database Management',
  'Digital Marketing', 'Cloud Computing (AWS, Azure)',
  'Search Engine Optimization (SEO)', 'Artificial Intelligence (AI)',
  'Search Engine Marketing (SEM)', 'Machine Learning',
  'Social Media Marketing', 'Cybersecurity',
  'Content Writing & Copywriting', 'CRM Software (Salesforce, HubSpot)',
  'UX/UI Design', 'Financial Analysis',
  'Graphic Design (Adobe Creative Suite)', 'Microsoft Excel (Advanced)',
  'Video Editing', 'Presentation Software (PowerPoint)'
];

let NATIONALITY_DATA = {};

// ─── App State ────────────────────────────────────────────────────────────────
let authMode        = 'login';
let selectedRole    = 'student';
let regStep         = 1;
let hasIdea         = false;

let selectedSkills      = []; // [{ name, certificate: null | {fileName, mimeType, fileData} }]
let selectedInterests   = []; // [string]
let otherSkillAdded     = false;
let otherInterestAdded  = false;

let currentUser     = null;
let chatWithUserId  = null;
let chatPollInterval = null;
let notifPollInterval = null;

const COUNTRIES = [
  'India','United States','Canada','United Kingdom','Australia','Germany','France',
  'China','Japan','Brazil','UAE','Pakistan','Bangladesh','South Africa','Nigeria',
  'Sri Lanka','Nepal','Singapore','Malaysia','Indonesia',
  'Argentina','Italy','Spain','Mexico','South Korea','Russia','Turkey','Egypt',
  'Kenya','Ghana','Ethiopia','Vietnam','Thailand','Philippines','Other'
];

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  setMaxDobDate();
  await loadNationalityData();
  populateCountryDropdowns();
  checkBackendConnection();
  loadOpportunities();
  currentUser = getStoredUser();
  if (currentUser) {
    syncNavUI();
    startNotifPolling();
  }
});

function setMaxDobDate() {
  const today = new Date().toISOString().split('T')[0];
  ['sDob','iDob'].forEach(id => { const el = document.getElementById(id); if (el) el.max = today; });
}

async function loadNationalityData() {
  try {
    const res = await fetch(`${API}/api/nationalities`);
    if (res.ok) { const j = await res.json(); NATIONALITY_DATA = j.data || {}; }
  } catch { /* use fallback */ }
  if (!Object.keys(NATIONALITY_DATA).length) {
    NATIONALITY_DATA = {
      'India': { code: '+91', minDigits: 10, maxDigits: 10 },
      'United States': { code: '+1', minDigits: 10, maxDigits: 10 },
      'Other': { code: '', minDigits: 5, maxDigits: 15 }
    };
  }
}

function populateCountryDropdowns() {
  const selectors = ['sNationality','iNationality','eNationality','eCountry'];
  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    COUNTRIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      el.appendChild(opt);
    });
  });
}

// ═══════════════════════════════════════════════════
// BACKEND HEALTH CHECK
// ═══════════════════════════════════════════════════
async function checkBackendConnection() {
  const badge = document.getElementById('backendStatusBadge');
  const text = document.getElementById('backendStatusText');
  if (!badge || !text) return;
  badge.className = 'backend-badge checking';
  text.textContent = 'Connecting...';
  try {
    const res = await fetch(`${API}/api/health`);
    if (res.ok) {
      badge.className = 'backend-badge connected';
      text.textContent = 'Backend Online';
    } else throw new Error();
  } catch {
    badge.className = 'backend-badge offline';
    text.textContent = 'Offline (retry)';
  }
}

// ═══════════════════════════════════════════════════
// OPPORTUNITIES
// ═══════════════════════════════════════════════════
async function loadOpportunities() {
  const grid = document.getElementById('opportunityGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/api/jobs`);
    if (!res.ok) throw new Error();
    const { data: jobs } = await res.json();
    grid.innerHTML = '';
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'opportunity-card';
      card.innerHTML = `
        <div class="company-logo">${job.logo || '💼'}</div>
        <div class="opportunity-info">
          <span class="tag">${job.tag}</span>
          <h3>${esc(job.title)}</h3>
          <p>${esc(job.company)}</p>
          <div class="details">📍 ${esc(job.location)} &nbsp;&nbsp; ⏱ ${esc(job.duration)}</div>
        </div>
        <div class="match"><strong>${job.match}%</strong><span>Match</span></div>
        <button class="apply-btn" onclick="applyJob('${esc(job.title)}',${job.id})">Apply</button>
      `;
      grid.appendChild(card);
    });
  } catch { /* keep static cards */ }
}

async function applyJob(title, jobId) {
  const user = currentUser;
  try {
    const res = await fetch(`${API}/api/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicantName: user?.name || 'Guest', applicantEmail: user?.email || 'guest@example.com', jobTitle: title, jobId })
    });
    const data = await res.json();
    alert(`✅ ${data.message}\n\nApplicant: ${user?.name || 'Guest'}`);
  } catch {
    alert(`Application started for:\n${title}\n\n⚠️ Backend offline.`);
  }
}

// ═══════════════════════════════════════════════════
// USER STORAGE
// ═══════════════════════════════════════════════════
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('skillswap_user')); } catch { return null; }
}
function saveUser(user) {
  localStorage.setItem('skillswap_user', JSON.stringify(user));
  currentUser = user;
}
function clearUser() {
  localStorage.removeItem('skillswap_user');
  currentUser = null;
}

// ═══════════════════════════════════════════════════
// NAVBAR SYNC
// ═══════════════════════════════════════════════════
function syncNavUI() {
  const container = document.getElementById('authNavContainer');
  const searchContainer = document.getElementById('navSearchContainer');
  const notifContainer = document.getElementById('notifContainer');
  if (!container) return;
  const user = currentUser;
  if (user) {
    if (searchContainer) searchContainer.style.display = 'flex';
    if (notifContainer) notifContainer.style.display = 'block';
    const roleEmoji = { student: '🎓', individual: '👤', enterprise: '🏢' }[user.role] || '👤';
    container.innerHTML = `
      <div class="user-profile-badge">
        <button class="profile-nav-btn" onclick="openProfile()">${roleEmoji} ${esc(user.name || 'Profile')}</button>
        <span class="user-credits">🪙 ${user.credits || 100}</span>
        <button class="logout-btn" onclick="logout()">Logout</button>
      </div>`;
    loadNotifications();
  } else {
    if (searchContainer) searchContainer.style.display = 'none';
    if (notifContainer) notifContainer.style.display = 'none';
    container.innerHTML = `<button class="login-btn" onclick="showLogin()">Login</button>`;
  }
}

function logout() {
  clearUser();
  stopNotifPolling();
  syncNavUI();
  closeProfile();
  closeSearch();
  closeChat();
}

// ═══════════════════════════════════════════════════
// LOGIN MODAL
// ═══════════════════════════════════════════════════
function showLogin() {
  document.getElementById('loginModal').style.display = 'flex';
  clearAlert();
  setAuthMode('login');
}
function closeLogin() {
  document.getElementById('loginModal').style.display = 'none';
  clearAlert();
}
function setAlert(msg, type = 'error') {
  const el = document.getElementById('modalAlert');
  if (!el) return;
  el.className = `modal-alert ${type}`;
  el.textContent = msg;
  el.style.display = 'block';
}
function clearAlert() {
  const el = document.getElementById('modalAlert');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function toggleAuthMode() {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
}

function setAuthMode(mode) {
  authMode = mode;
  clearAlert();
  const title = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  const roleSelector = document.getElementById('roleSelector');
  const stepIndicator = document.getElementById('regStepIndicator');
  const sectionLogin = document.getElementById('sectionLogin');
  const formNavBtns = document.getElementById('formNavBtns');
  const submitBtn = document.getElementById('authSubmitBtn');
  const togglePrompt = document.getElementById('authTogglePrompt');
  const toggleBtn = document.getElementById('authToggleBtn');

  if (mode === 'register') {
    title.textContent = 'Create Account 🚀';
    subtitle.textContent = 'Choose your account type';
    roleSelector.style.display = 'flex';
    stepIndicator.style.display = 'flex';
    sectionLogin.style.display = 'none';
    formNavBtns.style.display = 'flex';
    submitBtn.style.display = 'none';
    togglePrompt.textContent = 'Already have an account?';
    toggleBtn.textContent = 'Login';
    regStep = 1;
    selectedSkills = [];
    selectedInterests = [];
    hasIdea = false;
    selectRole(selectedRole);
  } else {
    title.textContent = 'Welcome Back 👋';
    subtitle.textContent = 'Login to AcademiaConnect';
    roleSelector.style.display = 'none';
    stepIndicator.style.display = 'none';
    sectionLogin.style.display = 'block';
    formNavBtns.style.display = 'none';
    submitBtn.style.display = 'block';
    submitBtn.textContent = 'Login';
    togglePrompt.textContent = "Don't have an account?";
    toggleBtn.textContent = 'Register';
    hideAllRegSections();
  }
}

function hideAllRegSections() {
  ['regStep1Student','regStep1Individual','regStep1Enterprise','regStep2','regStep3']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

// ─── Role selection ───────────────────────────────────────────────────────────
function selectRole(role) {
  selectedRole = role;
  ['student','individual','enterprise'].forEach(r => {
    const btn = document.getElementById(`tab${r.charAt(0).toUpperCase() + r.slice(1)}`);
    if (btn) btn.className = `role-tab-btn ${r === role ? 'active' : ''}`;
  });
  regStep = 1;
  updateRegView();
}

function updateRegView() {
  hideAllRegSections();
  updateStepDots();

  const back = document.getElementById('btnBack');
  const next = document.getElementById('btnNext');
  const submit = document.getElementById('authSubmitBtn');

  back.style.display = regStep > 1 ? 'block' : 'none';
  submit.style.display = 'none';

  if (regStep === 1) {
    next.style.display = 'block';
    next.textContent = 'Next →';
    const key = { student: 'regStep1Student', individual: 'regStep1Individual', enterprise: 'regStep1Enterprise' }[selectedRole];
    const el = document.getElementById(key);
    if (el) el.style.display = 'block';
  } else if (regStep === 2) {
    renderSkillsGrid();
    document.getElementById('regStep2').style.display = 'block';
    // Enterprise: "area served", unlimited; others: max 5
    const step2Title = document.getElementById('step2Title');
    const step2Subtitle = document.getElementById('step2Subtitle');
    if (selectedRole === 'enterprise') {
      step2Title.textContent = '🏢 Area Served';
      step2Subtitle.textContent = 'Select all areas your enterprise serves.';
    } else {
      step2Title.textContent = '🧠 Skills / Area of Expertise';
      step2Subtitle.textContent = 'Choose up to <strong>5 skills</strong>. You can add more after registration.';
    }
    if (selectedRole === 'enterprise') {
      // Enterprise skips step 3
      next.style.display = 'none';
      document.getElementById('formNavBtns').style.display = 'flex';
      document.getElementById('authSubmitBtn').style.display = 'block';
      document.getElementById('authSubmitBtn').textContent = 'Create Enterprise Account';
    } else {
      next.style.display = 'block';
      next.textContent = 'Next →';
    }
  } else if (regStep === 3) {
    renderInterestsGrid();
    document.getElementById('regStep3').style.display = 'block';
    next.style.display = 'none';
    document.getElementById('authSubmitBtn').style.display = 'block';
    document.getElementById('authSubmitBtn').textContent = 'Create My Account 🚀';
  }
}

function updateStepDots() {
  const maxStep = selectedRole === 'enterprise' ? 2 : 3;
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`sdot${i}`);
    if (!dot) continue;
    dot.className = i < regStep ? 'step-dot done' : (i === regStep ? 'step-dot active' : 'step-dot');
  }
}

function regNext() {
  clearAlert();
  if (regStep === 1 && !validateStep1()) return;
  if (regStep === 2 && !validateStep2()) return;
  regStep++;
  updateRegView();
  document.getElementById('authModalContent').scrollTop = 0;
}

function regBack() {
  clearAlert();
  regStep--;
  updateRegView();
  document.getElementById('authModalContent').scrollTop = 0;
}

// ─── Phone / Nationality ──────────────────────────────────────────────────────
function onNationalityChange(prefix) {
  const selEl = document.getElementById(`${prefix}Nationality`);
  if (!selEl) return;
  const nat = selEl.value;
  const rule = NATIONALITY_DATA[nat] || { code: '+', minDigits: 5, maxDigits: 15 };
  const dialEl = document.getElementById(`${prefix}DialCode`);
  const hintEl = document.getElementById(`${prefix}PhoneHint`);
  if (dialEl) dialEl.textContent = rule.code || '+';
  if (hintEl) hintEl.textContent = rule.minDigits === rule.maxDigits
    ? `${nat}: ${rule.minDigits}-digit number required`
    : `${nat}: ${rule.minDigits}–${rule.maxDigits} digit number required`;
}

// ─── Skills Grid ──────────────────────────────────────────────────────────────
function renderSkillsGrid() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  PREDEFINED_SKILLS.forEach(skill => {
    const chip = document.createElement('div');
    chip.className = 'skill-chip' + (isSkillSelected(skill) ? ' selected' : '');
    chip.textContent = skill;
    chip.onclick = () => toggleSkill(skill);
    grid.appendChild(chip);
  });
  // "Other" chip
  const other = document.createElement('div');
  other.className = 'skill-chip other';
  other.textContent = '+ Other';
  other.onclick = () => { document.getElementById('otherSkillContainer').style.display = 'block'; };
  grid.appendChild(other);
  renderSelectedSkills();
}

function isSkillSelected(name) { return selectedSkills.some(s => s.name === name); }

function toggleSkill(name) {
  const maxSkills = selectedRole === 'enterprise' ? 100 : 5;
  if (isSkillSelected(name)) {
    selectedSkills = selectedSkills.filter(s => s.name !== name);
  } else {
    if (selectedRole !== 'enterprise' && selectedSkills.length >= maxSkills) {
      setAlert(`You can select up to ${maxSkills} skills. Add more after registration.`); return;
    }
    selectedSkills.push({ name, certificate: null });
  }
  clearAlert();
  renderSkillsGrid();
}

function addOtherSkill() {
  const input = document.getElementById('otherSkillInput');
  const val = input?.value?.trim();
  if (!val) { setAlert('Please enter a skill name.'); return; }
  if (isSkillSelected(val)) { setAlert('Already added.'); return; }
  const maxSkills = selectedRole === 'enterprise' ? 100 : 5;
  if (selectedRole !== 'enterprise' && selectedSkills.length >= maxSkills) {
    setAlert(`Maximum ${maxSkills} skills allowed during registration.`); return;
  }
  selectedSkills.push({ name: val, certificate: null });
  input.value = '';
  document.getElementById('otherSkillContainer').style.display = 'none';
  clearAlert();
  renderSkillsGrid();
}

function renderSelectedSkills() {
  const list = document.getElementById('selectedSkillsList');
  if (!list) return;
  if (selectedSkills.length === 0) {
    list.innerHTML = '<p class="no-selection-hint">No skills selected yet. Click skills above to select.</p>';
    return;
  }
  list.innerHTML = selectedSkills.map((sk, idx) => `
    <div class="selected-skill-row">
      <span class="selected-skill-name">${esc(sk.name)}</span>
      <label class="cert-upload-label ${sk.certificate ? 'has-cert' : ''}" title="Upload certificate (PDF/JPG, max 1MB)">
        ${sk.certificate ? '✅ ' + esc(sk.certificate.fileName) : '📎 Add Certificate'}
        <input type="file" class="cert-input" accept=".pdf,.jpg,.jpeg" onchange="handleCertUpload(event, ${idx})">
      </label>
      <button class="remove-skill-btn" onclick="removeSkill(${idx})" title="Remove">×</button>
    </div>`).join('');
}

function removeSkill(idx) {
  selectedSkills.splice(idx, 1);
  renderSkillsGrid();
}

function handleCertUpload(event, idx) {
  const file = event.target.files[0];
  if (!file) return;
  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(file.type)) {
    setAlert('Certificate must be PDF, JPG, or JPEG.'); return;
  }
  if (file.size > 1024 * 1024) {
    setAlert(`"${file.name}" exceeds 1MB limit.`); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const base64 = e.target.result.split(',')[1];
    selectedSkills[idx].certificate = { fileName: file.name, mimeType: file.type, fileData: base64 };
    renderSelectedSkills();
    clearAlert();
  };
  reader.readAsDataURL(file);
}

// ─── Interests Grid ───────────────────────────────────────────────────────────
function renderInterestsGrid() {
  const grid = document.getElementById('interestsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  PREDEFINED_SKILLS.forEach(skill => {
    const chip = document.createElement('div');
    chip.className = 'skill-chip' + (selectedInterests.includes(skill) ? ' selected' : '');
    chip.textContent = skill;
    chip.onclick = () => toggleInterest(skill);
    grid.appendChild(chip);
  });
  const other = document.createElement('div');
  other.className = 'skill-chip other';
  other.textContent = '+ Other';
  other.onclick = () => { document.getElementById('otherInterestContainer').style.display = 'block'; };
  grid.appendChild(other);
  renderSelectedInterests();
}

function toggleInterest(name) {
  if (selectedInterests.includes(name)) {
    selectedInterests = selectedInterests.filter(i => i !== name);
  } else {
    selectedInterests.push(name);
  }
  renderInterestsGrid();
}

function addOtherInterest() {
  const input = document.getElementById('otherInterestInput');
  const val = input?.value?.trim();
  if (!val) { setAlert('Please enter an interest.'); return; }
  if (selectedInterests.includes(val)) { setAlert('Already added.'); return; }
  selectedInterests.push(val);
  input.value = '';
  document.getElementById('otherInterestContainer').style.display = 'none';
  clearAlert();
  renderInterestsGrid();
}

function renderSelectedInterests() {
  const list = document.getElementById('selectedInterestsList');
  if (!list) return;
  if (selectedInterests.length === 0) {
    list.innerHTML = '<p class="no-selection-hint">No interests selected yet.</p>';
    return;
  }
  list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">'
    + selectedInterests.map((int, idx) => `
      <div class="skill-chip selected" style="padding-right:6px;">
        ${esc(int)}
        <button onclick="removeInterest(${idx})" style="background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.7);margin-left:4px;font-size:14px;">×</button>
      </div>`).join('')
    + '</div>';
}

function removeInterest(idx) {
  selectedInterests.splice(idx, 1);
  renderInterestsGrid();
}

// ─── Idea ─────────────────────────────────────────────────────────────────────
function setHasIdea(val) {
  hasIdea = val;
  document.getElementById('ideaBtnYes').className = `idea-btn ${val ? 'active' : ''}`;
  document.getElementById('ideaBtnNo').className = `idea-btn ${!val ? 'active' : ''}`;
  document.getElementById('ideaInputContainer').style.display = val ? 'block' : 'none';
}

// ─── Step Validation ──────────────────────────────────────────────────────────
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStep1() {
  if (selectedRole === 'student') {
    const name = v('sName'), dob = v('sDob'), gender = v('sGender'), nat = v('sNationality'),
          phone = v('sPhone'), inst = v('sInstitution'), instId = v('sInstId'),
          cls = v('sClass'), email = v('sEmail'), pass = v('sPassword');
    if (!name) return err('Full name is required.');
    if (!dob) return err('Date of birth is required.');
    if (calcAge(dob) < 13) return err('You must be at least 13 years old to register.');
    if (!gender) return err('Please select your gender.');
    if (!nat) return err('Please select your nationality.');
    if (!phone) return err('Phone number is required.');
    const pr = validatePhone(phone, nat);
    if (!pr.valid) return err(pr.message);
    if (!inst) return err('School/College name is required.');
    if (!instId) return err('Institutional ID is required.');
    if (!/^[a-zA-Z0-9\-_./]{3,40}$/.test(instId)) return err('Invalid Institutional ID (e.g. STU-2026-081).');
    if (!cls) return err('Class / Grade / Year is required.');
    if (!email || !emailRe.test(email)) return err('Valid institutional email is required.');
    if (!pass || pass.length < 6) return err('Password must be at least 6 characters.');
  } else if (selectedRole === 'individual') {
    const name = v('iName'), dob = v('iDob'), gender = v('iGender'), nat = v('iNationality'),
          phone = v('iPhone'), email = v('iEmail'), pass = v('iPassword');
    if (!name) return err('Full name is required.');
    if (!dob) return err('Date of birth is required.');
    if (calcAge(dob) < 13) return err('You must be at least 13 years old to register.');
    if (!gender) return err('Please select your gender.');
    if (!nat) return err('Please select your nationality.');
    if (!phone) return err('Phone number is required.');
    const pr = validatePhone(phone, nat);
    if (!pr.valid) return err(pr.message);
    if (!email || !emailRe.test(email)) return err('Valid email address is required.');
    if (!pass || pass.length < 6) return err('Password must be at least 6 characters.');
  } else {
    const eName = v('eName'), eRole = v('eRole'), eCountry = v('eCountry'),
          eNat = v('eNationality'), ePhone = v('ePhone'), eEmail = v('eEmail'), ePass = v('ePassword');
    if (!eName) return err('Enterprise name is required.');
    if (!eRole) return err('Your role in the enterprise is required.');
    if (!eCountry) return err('Please select the country your enterprise is based in.');
    if (!eNat) return err('Please select a country for your phone number.');
    if (!ePhone) return err('Phone number is required.');
    const pr = validatePhone(ePhone, eNat);
    if (!pr.valid) return err(pr.message);
    if (!eEmail || !emailRe.test(eEmail)) return err('Valid enterprise email is required.');
    if (!ePass || ePass.length < 6) return err('Password must be at least 6 characters.');
  }
  return true;
}

function validateStep2() {
  if (selectedRole !== 'enterprise' && selectedSkills.length === 0) {
    return err('Please select at least one skill.');
  }
  return true;
}

function calcAge(dob) {
  const b = new Date(dob), today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function validatePhone(phone, nationality) {
  const rule = NATIONALITY_DATA[nationality] || { minDigits: 5, maxDigits: 15 };
  const digits = phone.replace(/\D/g, '');
  if (digits.length < rule.minDigits || digits.length > rule.maxDigits) {
    const range = rule.minDigits === rule.maxDigits ? rule.minDigits : `${rule.minDigits}–${rule.maxDigits}`;
    return { valid: false, message: `Phone for ${nationality} must be ${range} digits.` };
  }
  return { valid: true };
}

function v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function err(msg) { setAlert(msg); return false; }

// ─── FORM SUBMIT ──────────────────────────────────────────────────────────────
async function handleAuthSubmit(event) {
  event.preventDefault();
  clearAlert();

  if (authMode === 'login') {
    const email = v('loginEmail'), password = v('loginPassword');
    if (!email) return setAlert('Email is required.');
    if (!emailRe.test(email)) return setAlert('Valid email is required.');
    if (!password) return setAlert('Password is required.');
    await doLogin(email, password);
  } else {
    // Register — we're on step 2 (enterprise) or step 3 (others)
    if (regStep === 2 && selectedRole === 'enterprise') {
      await doRegister();
    } else if (regStep === 3) {
      await doRegister();
    }
  }
}

async function doLogin(email, password) {
  const btn = document.getElementById('authSubmitBtn');
  const orig = btn.textContent;
  btn.textContent = 'Logging in...'; btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      setAlert(data.message, 'success');
      saveUser(data.user);
      syncNavUI();
      startNotifPolling();
      setTimeout(() => { closeLogin(); }, 700);
    } else {
      setAlert(data.message || 'Login failed.');
    }
  } catch {
    setAlert(`Cannot reach backend at ${API}. Please start the server.`);
  }
  btn.textContent = orig; btn.disabled = false;
}

async function doRegister() {
  const btn = document.getElementById('authSubmitBtn');
  const orig = btn.textContent;
  btn.textContent = 'Creating account...'; btn.disabled = true;

  let payload = { role: selectedRole };

  if (selectedRole === 'student') {
    const nat = v('sNationality');
    const rule = NATIONALITY_DATA[nat] || {};
    payload = {
      ...payload, name: v('sName'), dateOfBirth: v('sDob'), gender: v('sGender'),
      nationality: nat, phone: (rule.code || '') + v('sPhone').replace(/\D/g,''),
      institution: v('sInstitution'), institutionalId: v('sInstId'), className: v('sClass'),
      email: v('sEmail'), fieldOfStudy: v('sField'), password: v('sPassword'),
      skills: selectedSkills, interests: selectedInterests,
      hasIdea, ideaDescription: hasIdea ? (document.getElementById('ideaInput')?.value?.trim() || '') : ''
    };
  } else if (selectedRole === 'individual') {
    const nat = v('iNationality');
    const rule = NATIONALITY_DATA[nat] || {};
    payload = {
      ...payload, name: v('iName'), dateOfBirth: v('iDob'), gender: v('iGender'),
      nationality: nat, phone: (rule.code || '') + v('iPhone').replace(/\D/g,''),
      email: v('iEmail'), password: v('iPassword'),
      skills: selectedSkills, interests: selectedInterests,
      hasIdea, ideaDescription: hasIdea ? (document.getElementById('ideaInput')?.value?.trim() || '') : ''
    };
  } else {
    const nat = v('eNationality');
    const rule = NATIONALITY_DATA[nat] || {};
    payload = {
      ...payload, enterpriseName: v('eName'), enterpriseRole: v('eRole'),
      enterpriseCountry: v('eCountry'), nationality: nat,
      phone: (rule.code || '') + v('ePhone').replace(/\D/g,''),
      email: v('eEmail'), password: v('ePassword'),
      areaServed: selectedSkills.map(s => s.name)
    };
  }

  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      setAlert(data.message, 'success');
      saveUser(data.user);
      syncNavUI();
      startNotifPolling();
      setTimeout(() => { closeLogin(); }, 800);
    } else {
      setAlert(data.message || 'Registration failed.');
    }
  } catch {
    setAlert(`Cannot reach backend at ${API}. Please start the server.`);
  }
  btn.textContent = orig; btn.disabled = false;
}

// Close modal on backdrop
window.onclick = e => { const m = document.getElementById('loginModal'); if (e.target === m) closeLogin(); };

// ═══════════════════════════════════════════════════
// PROFILE PANEL
// ═══════════════════════════════════════════════════
function openProfile() {
  if (!currentUser) { showLogin(); return; }
  openSidePanel('profilePanel', 'profileOverlay');
  renderProfilePanel(currentUser, true);
}
function closeProfile() { closeSidePanel('profilePanel', 'profileOverlay'); }

async function renderProfilePanel(user, isOwner) {
  const content = document.getElementById('profilePanelContent');
  const title = document.getElementById('profilePanelTitle');
  if (!content) return;

  // Reload fresh from server if we have an id
  if (user.id) {
    try {
      const res = await fetch(`${API}/api/profile/${user.id}?requesterId=${user.id}`);
      if (res.ok) { const j = await res.json(); user = j.data; if (isOwner) saveUser(user); }
    } catch {}
  }

  title.textContent = isOwner ? 'My Profile' : (user.name || 'User Profile');

  const privacy = (() => { try { return JSON.parse(user.privacySettings || '{}'); } catch { return {}; } })();

  const field = (label, key, value, editable = false) => {
    const displayVal = value || '<span style="color:#cbd5e1;">—</span>';
    const privIcon = privacy[key] === 'private' ? '🔒' : '🌐';
    return `
      <div class="profile-field">
        <span class="profile-field-label">${label}</span>
        <span class="profile-field-value" id="pf_${key}">${displayVal}</span>
        <div class="profile-field-actions">
          ${isOwner ? `<button class="privacy-toggle ${privacy[key] === 'private' ? 'private' : ''}" onclick="togglePrivacy('${key}')" title="${privacy[key] === 'private' ? 'Make Public' : 'Make Private'}">${privIcon}</button>` : ''}
          ${isOwner && editable ? `<button class="edit-btn-sm" onclick="editProfileField('${key}','${(value||'').replace(/'/g,"\\'")}')">✏️</button>` : ''}
        </div>
      </div>`;
  };

  const roleLabel = { student: '🎓 Student', individual: '👤 Individual', enterprise: '🏢 Enterprise' }[user.role] || user.role;

  let html = `
    <div class="profile-section">
      <h3>Basic Information</h3>
      ${field('Name', 'name', esc(user.name), true)}
      ${field('Role', 'role', roleLabel)}
      ${field('Email', 'email', esc(user.email))}
      ${user.gender ? field('Gender', 'gender', capitalize(user.gender)) : ''}
      ${user.dateOfBirth ? field('Date of Birth', 'dateOfBirth', new Date(user.dateOfBirth).toLocaleDateString()) : ''}
      ${user.nationality ? field('Nationality', 'nationality', esc(user.nationality)) : ''}
      ${user.phone ? field('Phone', 'phone', esc(user.phone)) : ''}
      ${field('Credits', 'credits', `🪙 ${user.credits}`)}
    </div>`;

  if (user.role === 'student') {
    html += `
      <div class="profile-section">
        <h3>Academic Details</h3>
        ${field('Institution', 'institution', esc(user.institution), true)}
        ${field('Institutional ID', 'institutionalId', esc(user.institutionalId))}
        ${field('Class / Year', 'className', esc(user.className), true)}
        ${user.fieldOfStudy ? field('Field of Study', 'fieldOfStudy', esc(user.fieldOfStudy), true) : ''}
      </div>`;
  }

  if (user.role === 'enterprise') {
    html += `
      <div class="profile-section">
        <h3>Enterprise Details</h3>
        ${field('Company Name', 'enterpriseName', esc(user.enterpriseName), true)}
        ${field('Your Role', 'enterpriseRole', esc(user.enterpriseRole), true)}
        ${field('Based In', 'enterpriseCountry', esc(user.enterpriseCountry))}
      </div>`;
  }

  // Skills
  const skills = user.skills || [];
  if (skills.length > 0) {
    html += `<div class="profile-section"><h3>${user.role === 'enterprise' ? 'Area Served' : 'Skills / Expertise'}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${skills.map(s => `<span class="skill-tag">${esc(s.name)}${s.certificate ? ' 📄' : ''}</span>`).join('')}
      </div></div>`;
  }

  // Interests
  const interests = user.interests || [];
  if (interests.length > 0 && user.role !== 'enterprise') {
    html += `<div class="profile-section"><h3>Areas of Interest</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${interests.map(i => `<span class="skill-tag" style="background:#f0fdf4;color:#166534;">${esc(i.name)}</span>`).join('')}
      </div></div>`;
  }

  // Idea
  if (user.hasIdea && user.ideaDescription) {
    html += `<div class="profile-section"><h3>💡 Current Idea</h3>
      <div class="idea-display">${esc(user.ideaDescription)}
        ${isOwner ? `<button class="edit-btn-sm" style="display:block;margin-top:8px;" onclick="editProfileField('ideaDescription','${esc(user.ideaDescription).replace(/'/g,"\\'")}')">✏️ Edit Idea</button>` : ''}
      </div></div>`;
  }

  // Education
  const education = user.education || [];
  html += `<div class="profile-section"><h3>🎓 Education</h3>`;
  if (education.length === 0) {
    html += `<p style="font-size:13px;color:#94a3b8;">No education added yet.</p>`;
  } else {
    education.forEach(edu => {
      html += `
        <div class="education-entry">
          <h4>${esc(edu.institution)}</h4>
          <p>${[edu.degree, edu.field].filter(Boolean).map(esc).join(' — ')}</p>
          <p style="font-size:12px;color:#10b981;margin-top:4px;">
            ${edu.status === 'attending' ? `📖 Attending since ${edu.startYear} (Expected: ${edu.expectedEnd || 'TBD'})` : `✅ ${edu.startYear} – ${edu.endYear}`}
          </p>
          ${isOwner ? `<button class="del-btn" onclick="deleteEducation(${edu.id})">🗑</button>` : ''}
        </div>`;
    });
  }
  if (isOwner) {
    html += `<button class="add-education-btn" onclick="showAddEducationForm()">+ Add Education</button>
      <div id="addEduForm" style="display:none;" class="add-edu-form">
        <h4>Add Education</h4>
        <div class="form-group"><label>Institution *</label><input id="eduInst" type="text" placeholder="e.g. MIT"></div>
        <div class="form-row">
          <div class="form-group"><label>Degree / Level</label><input id="eduDeg" type="text" placeholder="e.g. B.Tech, 12th"></div>
          <div class="form-group"><label>Field</label><input id="eduField" type="text" placeholder="e.g. Computer Science"></div>
        </div>
        <div class="form-group">
          <label>Status *</label>
          <select id="eduStatus" class="form-select" onchange="toggleEduStatusFields()">
            <option value="">Select...</option>
            <option value="completed">Completed</option>
            <option value="attending">Attending</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Start Year *</label><input id="eduStart" type="number" placeholder="e.g. 2020" min="1900" max="2100"></div>
          <div class="form-group" id="eduEndGroup" style="display:none;"><label>End Year *</label><input id="eduEnd" type="number" placeholder="e.g. 2024" min="1900" max="2100"></div>
          <div class="form-group" id="eduExpGroup" style="display:none;"><label>Expected End *</label><input id="eduExp" type="number" placeholder="e.g. 2028" min="2024" max="2060"></div>
        </div>
        <div class="edu-btns">
          <button type="button" class="secondary-btn" onclick="document.getElementById('addEduForm').style.display='none'">Cancel</button>
          <button type="button" class="primary-btn" onclick="saveEducation()">Save</button>
        </div>
      </div>`;
  }
  html += '</div>';

  content.innerHTML = html;
}

function toggleEduStatusFields() {
  const status = document.getElementById('eduStatus')?.value;
  const endGroup = document.getElementById('eduEndGroup');
  const expGroup = document.getElementById('eduExpGroup');
  if (endGroup) endGroup.style.display = status === 'completed' ? 'block' : 'none';
  if (expGroup) expGroup.style.display = status === 'attending' ? 'block' : 'none';
}

function showAddEducationForm() {
  const f = document.getElementById('addEduForm');
  if (f) f.style.display = 'block';
}

async function saveEducation() {
  if (!currentUser) return;
  const inst = document.getElementById('eduInst')?.value?.trim();
  const status = document.getElementById('eduStatus')?.value;
  const startYear = document.getElementById('eduStart')?.value;
  if (!inst) { alert('Institution is required.'); return; }
  if (!status) { alert('Status is required.'); return; }
  if (!startYear) { alert('Start year is required.'); return; }

  const body = {
    institution: inst,
    degree: document.getElementById('eduDeg')?.value?.trim(),
    field: document.getElementById('eduField')?.value?.trim(),
    status, startYear: parseInt(startYear),
    endYear: status === 'completed' ? parseInt(document.getElementById('eduEnd')?.value || '0') : null,
    expectedEnd: status === 'attending' ? parseInt(document.getElementById('eduExp')?.value || '0') : null
  };

  try {
    const res = await fetch(`${API}/api/profile/${currentUser.id}/education`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) { renderProfilePanel(currentUser, true); }
    else alert(data.message);
  } catch { alert('Could not save education. Backend offline?'); }
}

async function deleteEducation(eduId) {
  if (!confirm('Remove this education entry?')) return;
  try {
    await fetch(`${API}/api/education/${eduId}`, { method: 'DELETE' });
    renderProfilePanel(currentUser, true);
  } catch { alert('Backend offline.'); }
}

function editProfileField(key, currentValue) {
  const el = document.getElementById(`pf_${key}`);
  if (!el) return;
  const inputTag = key === 'ideaDescription' ? 'textarea' : 'input';
  el.outerHTML = `<${inputTag} id="pf_edit_${key}" class="profile-edit-input" value="${esc(currentValue)}" onblur="saveProfileField('${key}')" onkeydown="if(event.key==='Enter') saveProfileField('${key}')">${key === 'ideaDescription' ? esc(currentValue) : ''}</${inputTag}>`;
  const inp = document.getElementById(`pf_edit_${key}`);
  if (inp) { inp.focus(); inp.select(); }
}

async function saveProfileField(key) {
  const inp = document.getElementById(`pf_edit_${key}`);
  if (!inp || !currentUser) return;
  const value = inp.value.trim();
  try {
    const res = await fetch(`${API}/api/profile/${currentUser.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
    if (res.ok) { const j = await res.json(); saveUser({ ...currentUser, ...j.data }); renderProfilePanel(currentUser, true); }
  } catch { renderProfilePanel(currentUser, true); }
}

async function togglePrivacy(key) {
  if (!currentUser) return;
  let privacy = {};
  try { privacy = JSON.parse(currentUser.privacySettings || '{}'); } catch {}
  privacy[key] = privacy[key] === 'private' ? 'public' : 'private';
  try {
    const res = await fetch(`${API}/api/profile/${currentUser.id}/privacy`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacySettings: privacy })
    });
    if (res.ok) { saveUser({ ...currentUser, privacySettings: JSON.stringify(privacy) }); renderProfilePanel(currentUser, true); }
  } catch { saveUser({ ...currentUser, privacySettings: JSON.stringify(privacy) }); renderProfilePanel(currentUser, true); }
}

// ═══════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════
function doSearch() {
  const q = (document.getElementById('navSearchInput')?.value || document.getElementById('searchPanelInput')?.value || '').trim();
  if (!q) return;
  if (document.getElementById('navSearchInput')) document.getElementById('navSearchInput').value = q;
  if (document.getElementById('searchPanelInput')) document.getElementById('searchPanelInput').value = q;
  openSidePanel('searchPanel', 'searchOverlay');
  fetchSearchResults(q);
}

async function fetchSearchResults(q) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">Searching...</p>';
  try {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const users = data.data || [];
    if (users.length === 0) {
      container.innerHTML = `<div class="no-results">😕 No results found for "<strong>${esc(q)}</strong>".<br><br>Try a different name, skill, or idea keyword.</div>`;
      return;
    }
    container.innerHTML = users.map(u => buildUserCard(u)).join('');
  } catch {
    container.innerHTML = `<div class="no-results">⚠️ Backend offline. Start the server and try again.</div>`;
  }
}

function buildUserCard(u) {
  const role = u.role || 'individual';
  const roleEmoji = { student: '🎓', individual: '👤', enterprise: '🏢' }[role] || '👤';
  const skillsHtml = (u.skills || []).slice(0, 4).map(s => `<span class="skill-tag">${esc(s.name)}</span>`).join('');
  const idea = u.hasIdea && u.ideaDescription ? `<p style="font-size:12px;color:#92400e;background:#fffbeb;padding:5px 8px;border-radius:5px;margin-bottom:8px;">💡 ${esc(u.ideaDescription.substring(0, 80))}${u.ideaDescription.length > 80 ? '...' : ''}</p>` : '';
  const isSelf = currentUser && currentUser.id === u.id;
  const isEnterprise = role === 'enterprise';

  return `
    <div class="user-result-card">
      <div class="user-card-name">${roleEmoji} ${esc(u.name)}</div>
      <div class="user-card-role">${capitalize(role)}${u.nationality ? ' · ' + esc(u.nationality) : ''}</div>
      <div class="user-card-skills">${skillsHtml}</div>
      ${idea}
      <div class="user-card-actions">
        ${isSelf ? '' : `<button class="connect-btn" onclick="sendConnect(${u.id})">🔗 Connect</button>`}
        <button class="view-profile-btn" onclick="viewUserProfile(${u.id})">👤 View Profile</button>
        ${!isSelf ? `<button class="chat-open-btn" onclick="openChat(${u.id},'${esc(u.name)}')">💬 Chat</button>` : ''}
        ${isEnterprise && !isSelf ? `<button class="opp-check-btn" onclick="checkOpportunities(${u.id})">🎯 Check Opportunities</button>` : ''}
      </div>
    </div>`;
}

function closeSearch() { closeSidePanel('searchPanel', 'searchOverlay'); }

// ═══════════════════════════════════════════════════
// VIEW USER PROFILE
// ═══════════════════════════════════════════════════
async function viewUserProfile(userId) {
  openSidePanel('viewProfilePanel', 'viewProfileOverlay');
  const content = document.getElementById('viewProfileContent');
  const title = document.getElementById('viewProfileTitle');
  content.innerHTML = '<p style="text-align:center;padding:30px;color:#94a3b8;">Loading profile...</p>';

  try {
    const requesterId = currentUser?.id || '';
    const res = await fetch(`${API}/api/profile/${userId}?requesterId=${requesterId}`);
    const data = await res.json();
    if (!res.ok) { content.innerHTML = `<div class="no-results">${data.message}</div>`; return; }
    const u = data.data;
    title.textContent = u.name || 'User Profile';
    const isOwner = currentUser?.id === u.id;
    // Render a read-only version
    await renderProfilePanel(u, isOwner);
    // But update the view profile panel content
    const profileContent = document.getElementById('profilePanelContent');
    if (profileContent) {
      content.innerHTML = profileContent.innerHTML;
    }
  } catch {
    content.innerHTML = '<div class="no-results">⚠️ Backend offline.</div>';
  }
}

function closeViewProfile() { closeSidePanel('viewProfilePanel', 'viewProfileOverlay'); }

// ═══════════════════════════════════════════════════
// CONNECTIONS
// ═══════════════════════════════════════════════════
async function sendConnect(receiverId) {
  if (!currentUser) { showLogin(); return; }
  try {
    const res = await fetch(`${API}/api/connections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: currentUser.id, receiverId })
    });
    const data = await res.json();
    if (res.ok) { alert('✅ Connection request sent!'); }
    else { alert(data.message || 'Could not send connection request.'); }
  } catch { alert('Backend offline.'); }
}

async function respondToConnection(connectionId, status) {
  try {
    const res = await fetch(`${API}/api/connections/${connectionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) { alert(`Connection ${status}!`); loadNotifications(); }
    else { alert(data.message); }
  } catch { alert('Backend offline.'); }
}

// ═══════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') loadNotifications();
}

async function loadNotifications() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API}/api/notifications/${currentUser.id}`);
    if (!res.ok) return;
    const data = await res.json();
    const notifs = data.data || [];
    const unread = notifs.filter(n => !n.isRead).length;

    const badge = document.getElementById('notifCount');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }

    const list = document.getElementById('notifList');
    if (!list) return;

    if (notifs.length === 0) {
      list.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
      return;
    }

    list.innerHTML = notifs.map(n => {
      const meta = (() => { try { return JSON.parse(n.metadata || '{}'); } catch { return {}; } })();
      const icon = { connection_request: '🔗', message: '💬', system: '📢', connection_accepted: '✅' }[n.type] || '🔔';
      const isConnRequest = n.type === 'connection_request';
      const time = new Date(n.createdAt).toLocaleString();
      return `
        <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
          <span class="notif-item-icon">${icon}</span>
          <div class="notif-item-body">
            <div class="notif-item-text">${esc(n.message)}</div>
            ${isConnRequest && meta.connectionId ? `
              <button class="accept-conn-btn" onclick="event.stopPropagation();respondToConnection(${meta.connectionId},'accepted')">✅ Accept</button>
              <button class="reject-conn-btn" onclick="event.stopPropagation();respondToConnection(${meta.connectionId},'rejected')">Decline</button>` : ''}
            <div class="notif-item-time">${time}</div>
          </div>
        </div>`;
    }).join('');
  } catch { /* silent */ }
}

async function markNotifRead(notifId) {
  try { await fetch(`${API}/api/notifications/${notifId}/read`, { method: 'PATCH' }); loadNotifications(); } catch {}
}

async function markAllNotifRead() {
  if (!currentUser) return;
  try { await fetch(`${API}/api/notifications/${currentUser.id}/read-all`, { method: 'PATCH' }); loadNotifications(); } catch {}
}

function startNotifPolling() {
  stopNotifPolling();
  notifPollInterval = setInterval(loadNotifications, 15000);
}
function stopNotifPolling() {
  if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; }
}

// ═══════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════
function openChat(userId, userName) {
  if (!currentUser) { showLogin(); return; }
  chatWithUserId = userId;
  const title = document.getElementById('chatPanelTitle');
  if (title) title.textContent = `Chat with ${userName}`;
  openSidePanel('chatPanel', 'chatOverlay');
  loadChatMessages();
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(loadChatMessages, 5000);
}

function closeChat() {
  closeSidePanel('chatPanel', 'chatOverlay');
  chatWithUserId = null;
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
}

async function loadChatMessages() {
  if (!currentUser || !chatWithUserId) return;
  try {
    const res = await fetch(`${API}/api/messages/${currentUser.id}/${chatWithUserId}`);
    if (!res.ok) return;
    const data = await res.json();
    const messages = data.data || [];
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:40px 20px;font-size:13px;">No messages yet.<br>Say hello! 👋</div>`;
      return;
    }

    const wasAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
    container.innerHTML = messages.map(m => {
      const isSent = m.senderId === currentUser.id;
      const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-bubble ${isSent ? 'sent' : 'received'}">${esc(m.content)}<div class="chat-bubble-time">${time}</div></div>`;
    }).join('');

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
  } catch {}
}

async function sendChatMessage() {
  if (!currentUser || !chatWithUserId) return;
  const input = document.getElementById('chatInput');
  const content = input?.value?.trim();
  if (!content) return;
  input.value = '';
  try {
    await fetch(`${API}/api/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: currentUser.id, receiverId: chatWithUserId, content })
    });
    loadChatMessages();
  } catch { alert('Backend offline.'); }
}

// ═══════════════════════════════════════════════════
// OPPORTUNITY CHECK
// ═══════════════════════════════════════════════════
async function checkOpportunities(enterpriseId) {
  if (!currentUser) { showLogin(); return; }
  openSidePanel('oppCheckPanel', 'oppCheckOverlay');
  const content = document.getElementById('oppCheckContent');
  content.innerHTML = '<p style="text-align:center;padding:30px;color:#94a3b8;">Analysing your profile...</p>';

  try {
    const res = await fetch(`${API}/api/opportunities/check?userId=${currentUser.id}&enterpriseId=${enterpriseId}`);
    const data = await res.json();
    if (!res.ok) { content.innerHTML = `<div class="no-results">${data.message}</div>`; return; }
    const r = data.data;

    const scoreClass = r.matchPercent >= 50 ? 'high' : 'low';
    content.innerHTML = `
      <div class="opp-score-ring">
        <div class="opp-score-circle ${scoreClass}">${r.matchPercent}<span style="font-size:14px">%</span></div>
        <strong>Match with ${esc(r.enterpriseName || 'Enterprise')}</strong>
        <p style="font-size:13px;color:#64748b;margin-top:6px;">${esc(r.recommendation)}</p>
      </div>
      ${r.matched.length > 0 ? `
        <div class="profile-section">
          <h3>✅ Matched Skills</h3>
          ${r.matched.map(s => `<div class="opp-skill-row opp-skill-matched"><span class="match-icon">✅</span> ${esc(s)}</div>`).join('')}
        </div>` : ''}
      ${r.missing.length > 0 ? `
        <div class="profile-section">
          <h3>❌ Skills to Develop</h3>
          ${r.missing.map(s => `<div class="opp-skill-row opp-skill-missing"><span class="match-icon">📌</span> ${esc(s)}</div>`).join('')}
        </div>` : ''}
      <button class="apply-now-btn" onclick="applyJob('${esc(r.enterpriseName || 'Enterprise')}',${enterpriseId})" ${!r.canApply ? 'disabled title="Improve your skills first"' : ''}>
        ${r.canApply ? '🚀 Apply Now' : '⚠️ Build More Skills First'}
      </button>`;
  } catch {
    content.innerHTML = '<div class="no-results">⚠️ Backend offline.</div>';
  }
}

function closeOppCheck() { closeSidePanel('oppCheckPanel', 'oppCheckOverlay'); }

// ═══════════════════════════════════════════════════
// SIDE PANEL HELPERS
// ═══════════════════════════════════════════════════
function openSidePanel(panelId, overlayId) {
  const panel = document.getElementById(panelId);
  const overlay = document.getElementById(overlayId);
  if (panel) { panel.style.display = 'flex'; setTimeout(() => panel.classList.add('open'), 10); }
  if (overlay) overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeSidePanel(panelId, overlayId) {
  const panel = document.getElementById(panelId);
  const overlay = document.getElementById(overlayId);
  if (panel) { panel.classList.remove('open'); setTimeout(() => { panel.style.display = 'none'; }, 300); }
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════
// HERO BUTTONS
// ═══════════════════════════════════════════════════
async function startJourney() {
  try {
    const res = await fetch(`${API}/api/skills-list`);
    if (res.ok) {
      const data = await res.json();
      const list = (data.data || []).map(s => `• ${s}`).join('\n');
      alert(`Welcome to AcademiaConnect! 🚀\n\nAvailable Skill Domains:\n${list}`);
      return;
    }
  } catch {}
  alert("Welcome to AcademiaConnect! 🚀\n\nYour journey:\n1. Create Profile\n2. Assess Skills\n3. Find Gaps\n4. Learn\n5. Connect with Industry");
}

function scrollToOpportunities() {
  document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g,' ');
}