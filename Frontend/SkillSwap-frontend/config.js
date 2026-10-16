// ═══════════════════════════════════════════════════════
// AcademiaConnect / SkillSwap — Frontend Config
//
// ⚡ After deploying the backend to Render.com,
//    paste your Render URL below as PRODUCTION_API.
//
//    Example:
//    const PRODUCTION_API = 'https://skillswap-backend.onrender.com';
//
// ✅ When running locally, keep LOCAL_API as is.
// ═══════════════════════════════════════════════════════

const LOCAL_API       = 'http://localhost:3000';
const PRODUCTION_API  = '';   // ← PASTE YOUR RENDER URL HERE after deploying

// Auto-detect: if this page is opened from localhost/127.0.0.1/file://
// use local backend; otherwise use the production backend.
const isLocal = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:'
);

window.API_CONFIG = {
  BASE_URL: (PRODUCTION_API && !isLocal) ? PRODUCTION_API : LOCAL_API
};

