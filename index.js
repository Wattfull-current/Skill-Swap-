require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const express = require('express');
const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' })); // allow base64 certificate uploads

app.use((req, res, next) => {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// ─── Constants ─────────────────────────────────────────────────────────────────
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

const NATIONALITY_PHONE = {
  'India':        { code: '+91', minDigits: 10, maxDigits: 10 },
  'United States':{ code: '+1',  minDigits: 10, maxDigits: 10 },
  'Canada':       { code: '+1',  minDigits: 10, maxDigits: 10 },
  'United Kingdom':{ code: '+44', minDigits: 10, maxDigits: 10 },
  'Australia':    { code: '+61', minDigits:  9, maxDigits:  9 },
  'Germany':      { code: '+49', minDigits: 10, maxDigits: 11 },
  'France':       { code: '+33', minDigits:  9, maxDigits:  9 },
  'China':        { code: '+86', minDigits: 11, maxDigits: 11 },
  'Japan':        { code: '+81', minDigits: 10, maxDigits: 11 },
  'Brazil':       { code: '+55', minDigits: 10, maxDigits: 11 },
  'UAE':          { code: '+971',minDigits:  9, maxDigits:  9 },
  'Pakistan':     { code: '+92', minDigits: 10, maxDigits: 10 },
  'Bangladesh':   { code: '+880',minDigits: 10, maxDigits: 10 },
  'South Africa': { code: '+27', minDigits:  9, maxDigits:  9 },
  'Nigeria':      { code: '+234',minDigits:  8, maxDigits: 10 },
  'Sri Lanka':    { code: '+94', minDigits:  9, maxDigits:  9 },
  'Nepal':        { code: '+977',minDigits:  9, maxDigits: 10 },
  'Singapore':    { code: '+65', minDigits:  8, maxDigits:  8 },
  'Malaysia':     { code: '+60', minDigits:  9, maxDigits: 10 },
  'Indonesia':    { code: '+62', minDigits:  9, maxDigits: 12 },
  'Other':        { code: '',    minDigits:  5, maxDigits: 15 },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function calculateAge(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function validatePhone(phone, nationality) {
  const rule = NATIONALITY_PHONE[nationality] || NATIONALITY_PHONE['Other'];
  const digits = phone.replace(/\D/g, '');
  if (digits.length < rule.minDigits || digits.length > rule.maxDigits) {
    return {
      valid: false,
      message: `Phone number for ${nationality} must be ${rule.minDigits === rule.maxDigits ? rule.minDigits : rule.minDigits + '–' + rule.maxDigits} digits.`
    };
  }
  return { valid: true };
}

function safeJsonParse(str, fallback = {}) {
  try { return JSON.parse(str); } catch { return fallback; }
}

async function tryPrisma(fn, fallback) {
  try { return await fn(); } catch (err) {
    console.warn('DB unavailable (fallback):', err.message.split('\n')[0]);
    return fallback;
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'success', message: 'Backend is connected and healthy', timestamp: new Date().toISOString(), port: PORT });
});

// Skills list
app.get('/api/skills-list', (req, res) => {
  res.json({ status: 'success', data: PREDEFINED_SKILLS });
});

// Nationality & phone rules
app.get('/api/nationalities', (req, res) => {
  res.json({ status: 'success', data: NATIONALITY_PHONE });
});

// ─── AUTH: REGISTER ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const {
    role,
    // Step 1 common
    name, email, password, gender,
    dateOfBirth, nationality, phone,
    // Student
    institutionalId, className, fieldOfStudy, institution,
    // Enterprise
    enterpriseName, enterpriseRole, enterpriseCountry,
    // Step 2
    skills = [],    // [{ name, certificate?: { fileName, mimeType, fileData } }]
    areaServed = [], // enterprise
    // Step 3 (student/individual)
    interests = [],
    hasIdea = false,
    ideaDescription = ''
  } = req.body;

  const userRole = (role || 'student').toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ── Common validations ──
  const effectiveEmail = email ? email.trim().toLowerCase() : '';
  const effectiveNationality = nationality || 'Other';

  // DOB & age (student / individual)
  if (userRole !== 'enterprise') {
    if (!dateOfBirth) {
      return res.status(400).json({ status: 'error', message: 'Date of birth is required.' });
    }
    const age = calculateAge(dateOfBirth);
    if (age < 13) {
      return res.status(400).json({ status: 'error', message: 'You must be at least 13 years old to register.' });
    }
  }

  // Phone validation (all roles)
  if (!phone || !phone.trim()) {
    return res.status(400).json({ status: 'error', message: 'Phone number is required.' });
  }
  const phoneCheck = validatePhone(phone.trim(), effectiveNationality);
  if (!phoneCheck.valid) {
    return res.status(400).json({ status: 'error', message: phoneCheck.message });
  }

  // ── Role-specific validations ──
  if (userRole === 'student') {
    if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    if (!institution?.trim()) return res.status(400).json({ status: 'error', message: 'School/College name is required.' });
    if (!institutionalId?.trim()) return res.status(400).json({ status: 'error', message: 'Institutional ID is required for student registration.' });
    const idPattern = /^[a-zA-Z0-9\-_./]{3,40}$/;
    if (!idPattern.test(institutionalId.trim())) return res.status(400).json({ status: 'error', message: 'Invalid Institutional ID (e.g. STU-2026-081).' });
    if (!className?.trim()) return res.status(400).json({ status: 'error', message: 'Class / Grade / Year is required.' });
    if (!effectiveEmail || !emailRegex.test(effectiveEmail)) return res.status(400).json({ status: 'error', message: 'A valid institutional email is required.' });
  } else if (userRole === 'enterprise') {
    if (!enterpriseName?.trim()) return res.status(400).json({ status: 'error', message: 'Enterprise name is required.' });
    if (!enterpriseRole?.trim()) return res.status(400).json({ status: 'error', message: 'Your role in the enterprise is required.' });
    if (!effectiveEmail || !emailRegex.test(effectiveEmail)) return res.status(400).json({ status: 'error', message: 'A valid enterprise email is required.' });
  } else {
    // individual
    if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    if (!effectiveEmail || !emailRegex.test(effectiveEmail)) return res.status(400).json({ status: 'error', message: 'A valid email is required.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters.' });
  }

  // Certificate validation (max 1 MB per file, valid mime types)
  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  for (const sk of skills) {
    if (sk.certificate) {
      const { mimeType, fileData } = sk.certificate;
      if (!allowedMimes.includes(mimeType)) {
        return res.status(400).json({ status: 'error', message: `Certificate for "${sk.name}" must be PDF, JPG, or JPEG.` });
      }
      const sizeBytes = Buffer.byteLength(fileData, 'base64');
      if (sizeBytes > 1024 * 1024) {
        return res.status(400).json({ status: 'error', message: `Certificate for "${sk.name}" must be under 1MB.` });
      }
    }
  }

  // Build profile
  const effectiveName = userRole === 'enterprise' ? `${enterpriseName.trim()} (${enterpriseRole.trim()})` : name.trim();
  const profileData = {
    role: userRole,
    name: effectiveName,
    email: effectiveEmail,
    password,  // in production hash with bcrypt
    gender: gender || null,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    nationality: effectiveNationality,
    phone: phone.trim(),
    credits: userRole === 'enterprise' ? 500 : 100,
    institutionalId: institutionalId?.trim() || null,
    className: className?.trim() || null,
    fieldOfStudy: fieldOfStudy?.trim() || null,
    institution: institution?.trim() || null,
    enterpriseName: enterpriseName?.trim() || null,
    enterpriseRole: enterpriseRole?.trim() || null,
    enterpriseCountry: enterpriseCountry?.trim() || null,
    hasIdea: Boolean(hasIdea),
    ideaDescription: hasIdea ? ideaDescription?.trim() : null,
    privacySettings: JSON.stringify({ phone: 'private', dateOfBirth: 'private', email: 'public', name: 'public' })
  };

  // Try saving to DB
  const result = await tryPrisma(async () => {
    const newUser = await prisma.user.create({ data: profileData });

    // Create skills
    const skillsToCreate = userRole === 'enterprise' ? areaServed : skills.slice(0, 5);
    for (const sk of skillsToCreate) {
      if (!sk.name?.trim()) continue;
      const createdSkill = await prisma.skill.create({
        data: { name: sk.name.trim(), userId: newUser.id }
      });
      if (sk.certificate) {
        await prisma.certificate.create({
          data: {
            fileName: sk.certificate.fileName,
            mimeType: sk.certificate.mimeType,
            fileData: sk.certificate.fileData,
            skillId: createdSkill.id
          }
        });
      }
    }

    // Create interests (student/individual)
    if (userRole !== 'enterprise') {
      for (const interest of interests) {
        if (!interest?.trim()) continue;
        await prisma.interest.create({ data: { name: interest.trim(), userId: newUser.id } });
      }
    }

    return { user: newUser, dbMode: true };
  }, null);

  if (result === null) {
    // Fallback
    const fallbackUser = { id: Date.now(), ...profileData };
    return res.status(201).json({
      status: 'success',
      message: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} account created! (Offline mode)`,
      user: { ...fallbackUser, skills, interests }
    });
  }

  const { user: newUser } = result;
  const userWithRelations = await tryPrisma(() => prisma.user.findUnique({
    where: { id: newUser.id },
    include: { skills: { include: { certificate: true } }, interests: true, education: true }
  }), newUser);

  return res.status(201).json({
    status: 'success',
    message: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} account created successfully!`,
    user: userWithRelations
  });
});

// ─── AUTH: LOGIN ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim()) return res.status(400).json({ status: 'error', message: 'Email is required.' });

  const foundUser = await tryPrisma(() => prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { skills: { include: { certificate: true } }, interests: true, education: true }
  }), null);

  if (foundUser === null) {
    // DB offline fallback
    return res.json({ status: 'success', message: 'Login successful (Offline mode)', user: { id: 1, email: email.trim(), name: email.split('@')[0], role: 'student', credits: 100 } });
  }

  if (!foundUser) {
    return res.status(404).json({ status: 'error', message: 'No account found with this email. Please register first.' });
  }

  return res.json({ status: 'success', message: 'Login successful!', user: foundUser });
});

// ─── PROFILE: GET ─────────────────────────────────────────────────────────────
app.get('/api/profile/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const requesterId = req.query.requesterId ? parseInt(req.query.requesterId) : null;

  const user = await tryPrisma(() => prisma.user.findUnique({
    where: { id: userId },
    include: { skills: { include: { certificate: true } }, interests: true, education: true }
  }), null);

  if (!user) return res.status(404).json({ status: 'error', message: 'User not found.' });

  // Apply privacy filter if viewer is not the owner
  if (requesterId !== userId) {
    const privacy = safeJsonParse(user.privacySettings, {});
    const fieldsToCheck = ['phone', 'dateOfBirth', 'email', 'gender', 'nationality'];
    for (const field of fieldsToCheck) {
      if (privacy[field] === 'private') {
        user[field] = null;
      }
    }
    // Remove password always
    delete user.password;
  } else {
    delete user.password;
  }

  res.json({ status: 'success', data: user });
});

// ─── PROFILE: UPDATE ─────────────────────────────────────────────────────────
app.put('/api/profile/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const updates = req.body;
  delete updates.id; delete updates.email; delete updates.password;

  const updated = await tryPrisma(() => prisma.user.update({
    where: { id: userId }, data: updates,
    include: { skills: true, interests: true, education: true }
  }), null);

  if (!updated) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  res.json({ status: 'success', message: 'Profile updated.', data: updated });
});

// ─── PROFILE: PRIVACY SETTINGS ───────────────────────────────────────────────
app.patch('/api/profile/:userId/privacy', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { privacySettings } = req.body; // JSON object

  const updated = await tryPrisma(() => prisma.user.update({
    where: { id: userId }, data: { privacySettings: JSON.stringify(privacySettings) }
  }), null);

  if (!updated) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  res.json({ status: 'success', message: 'Privacy settings updated.', data: safeJsonParse(updated.privacySettings) });
});

// ─── EDUCATION: ADD ──────────────────────────────────────────────────────────
app.post('/api/profile/:userId/education', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { institution, degree, field, status, startYear, endYear, expectedEnd } = req.body;

  if (!institution?.trim()) return res.status(400).json({ status: 'error', message: 'Institution name is required.' });
  if (!status || !['completed', 'attending'].includes(status)) return res.status(400).json({ status: 'error', message: 'Status must be "completed" or "attending".' });
  if (!startYear) return res.status(400).json({ status: 'error', message: 'Start year is required.' });

  const edu = await tryPrisma(() => prisma.education.create({
    data: { userId, institution: institution.trim(), degree: degree?.trim(), field: field?.trim(), status, startYear: parseInt(startYear), endYear: endYear ? parseInt(endYear) : null, expectedEnd: expectedEnd ? parseInt(expectedEnd) : null }
  }), null);

  if (!edu) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  res.status(201).json({ status: 'success', message: 'Education entry added.', data: edu });
});

// ─── EDUCATION: DELETE ───────────────────────────────────────────────────────
app.delete('/api/education/:eduId', async (req, res) => {
  const eduId = parseInt(req.params.eduId);
  await tryPrisma(() => prisma.education.delete({ where: { id: eduId } }), null);
  res.json({ status: 'success', message: 'Education entry deleted.' });
});

// ─── SKILLS: ADD AFTER REGISTRATION ─────────────────────────────────────────
app.post('/api/profile/:userId/skills', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { name, certificate } = req.body;
  if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'Skill name is required.' });

  const skill = await tryPrisma(async () => {
    const sk = await prisma.skill.create({ data: { name: name.trim(), userId } });
    if (certificate) {
      await prisma.certificate.create({
        data: { fileName: certificate.fileName, mimeType: certificate.mimeType, fileData: certificate.fileData, skillId: sk.id }
      });
    }
    return await prisma.skill.findUnique({ where: { id: sk.id }, include: { certificate: true } });
  }, null);

  if (!skill) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  res.status(201).json({ status: 'success', data: skill });
});

// ─── SEARCH ──────────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required.' });

  const query = q.trim();

  const results = await tryPrisma(async () => {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { enterpriseName: { contains: query, mode: 'insensitive' } },
          { ideaDescription: { contains: query, mode: 'insensitive' } },
          { skills: { some: { name: { contains: query, mode: 'insensitive' } } } }
        ]
      },
      include: { skills: true, interests: true },
      take: 20
    });

    return users.map(u => {
      const privacy = safeJsonParse(u.privacySettings, {});
      delete u.password;
      if (privacy.email === 'private') u.email = null;
      if (privacy.phone === 'private') u.phone = null;
      return u;
    });
  }, []);

  res.json({ status: 'success', data: results, query });
});

// ─── CONNECTIONS ─────────────────────────────────────────────────────────────
app.post('/api/connections', async (req, res) => {
  const { senderId, receiverId } = req.body;
  if (!senderId || !receiverId) return res.status(400).json({ status: 'error', message: 'senderId and receiverId are required.' });
  if (senderId === receiverId) return res.status(400).json({ status: 'error', message: 'You cannot connect with yourself.' });

  const connection = await tryPrisma(async () => {
    const existing = await prisma.connection.findFirst({ where: { senderId, receiverId, status: { in: ['pending', 'accepted'] } } });
    if (existing) throw new Error('Connection already exists.');

    const conn = await prisma.connection.create({ data: { senderId, receiverId, status: 'pending' } });
    const senderUser = await prisma.user.findUnique({ where: { id: senderId } });
    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: receiverId, type: 'connection_request',
        message: `${senderUser.name} wants to connect with you.`,
        metadata: JSON.stringify({ senderId, connectionId: conn.id })
      }
    });
    return conn;
  }, null);

  if (connection === null) {
    return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  }

  res.status(201).json({ status: 'success', message: 'Connection request sent!', data: connection });
});

// Accept/Reject connection
app.patch('/api/connections/:connectionId', async (req, res) => {
  const connectionId = parseInt(req.params.connectionId);
  const { status } = req.body; // 'accepted' | 'rejected'

  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ status: 'error', message: 'Status must be "accepted" or "rejected".' });

  const updated = await tryPrisma(async () => {
    const conn = await prisma.connection.update({ where: { id: connectionId }, data: { status } });
    if (status === 'accepted') {
      const receiver = await prisma.user.findUnique({ where: { id: conn.receiverId } });
      await prisma.notification.create({
        data: {
          userId: conn.senderId, type: 'connection_accepted',
          message: `${receiver.name} accepted your connection request!`,
          metadata: JSON.stringify({ connectionId })
        }
      });
    }
    return conn;
  }, null);

  if (!updated) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  res.json({ status: 'success', message: `Connection ${status}.`, data: updated });
});

// Get user's connections
app.get('/api/connections/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const connections = await tryPrisma(() => prisma.connection.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }], status: 'accepted' },
    include: { sender: { select: { id: true, name: true, role: true } }, receiver: { select: { id: true, name: true, role: true } } }
  }), []);
  res.json({ status: 'success', data: connections });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const notifications = await tryPrisma(() => prisma.notification.findMany({
    where: { userId }, orderBy: { createdAt: 'desc' }, take: 50
  }), []);
  res.json({ status: 'success', data: notifications });
});

app.patch('/api/notifications/:notifId/read', async (req, res) => {
  const notifId = parseInt(req.params.notifId);
  await tryPrisma(() => prisma.notification.update({ where: { id: notifId }, data: { isRead: true } }), null);
  res.json({ status: 'success', message: 'Notification marked as read.' });
});

app.patch('/api/notifications/:userId/read-all', async (req, res) => {
  const userId = parseInt(req.params.userId);
  await tryPrisma(() => prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }), null);
  res.json({ status: 'success', message: 'All notifications marked as read.' });
});

// ─── MESSAGES / CHAT ─────────────────────────────────────────────────────────
app.post('/api/messages', async (req, res) => {
  const { senderId, receiverId, content } = req.body;
  if (!senderId || !receiverId || !content?.trim()) return res.status(400).json({ status: 'error', message: 'senderId, receiverId, and content are required.' });

  const msg = await tryPrisma(async () => {
    const message = await prisma.message.create({ data: { senderId, receiverId, content: content.trim() } });
    // Create notification for receiver
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    await prisma.notification.create({
      data: {
        userId: receiverId, type: 'message',
        message: `New message from ${sender.name}`,
        metadata: JSON.stringify({ senderId, messageId: message.id })
      }
    });
    return message;
  }, null);

  if (!msg) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
  res.status(201).json({ status: 'success', data: msg });
});

app.get('/api/messages/:userId1/:userId2', async (req, res) => {
  const u1 = parseInt(req.params.userId1);
  const u2 = parseInt(req.params.userId2);

  const messages = await tryPrisma(() => prisma.message.findMany({
    where: { OR: [{ senderId: u1, receiverId: u2 }, { senderId: u2, receiverId: u1 }] },
    orderBy: { createdAt: 'asc' }
  }), []);

  // Mark as read
  await tryPrisma(() => prisma.message.updateMany({
    where: { senderId: u2, receiverId: u1, isRead: false }, data: { isRead: true }
  }), null);

  res.json({ status: 'success', data: messages });
});

// ─── OPPORTUNITIES CHECK ─────────────────────────────────────────────────────
app.get('/api/opportunities/check', async (req, res) => {
  const { userId, enterpriseId } = req.query;
  if (!userId || !enterpriseId) return res.status(400).json({ status: 'error', message: 'userId and enterpriseId required.' });

  const user = await tryPrisma(() => prisma.user.findUnique({
    where: { id: parseInt(userId) }, include: { skills: true }
  }), null);
  const enterprise = await tryPrisma(() => prisma.user.findUnique({
    where: { id: parseInt(enterpriseId) }, include: { skills: true }
  }), null);

  if (!user || !enterprise) {
    return res.status(404).json({ status: 'error', message: 'User or enterprise not found.' });
  }

  const userSkills = user.skills.map(s => s.name.toLowerCase());
  const requiredSkills = enterprise.skills.map(s => s.name.toLowerCase());

  if (requiredSkills.length === 0) {
    return res.json({ status: 'success', data: { matchPercent: 0, matched: [], missing: [], recommendation: 'This enterprise has not specified required skills yet.', canApply: false } });
  }

  const matched = requiredSkills.filter(rs => userSkills.some(us => us.includes(rs) || rs.includes(us)));
  const missing = requiredSkills.filter(rs => !userSkills.some(us => us.includes(rs) || rs.includes(us)));
  const matchPercent = Math.round((matched.length / requiredSkills.length) * 100);
  const canApply = matchPercent >= 50;

  const recommendation = canApply
    ? `Your profile is a strong match (${matchPercent}%). You are qualified to apply!`
    : `Your profile matches ${matchPercent}% of required skills. Work on: ${missing.slice(0, 3).join(', ')}.`;

  res.json({
    status: 'success',
    data: { matchPercent, matched, missing, recommendation, canApply, userName: user.name, enterpriseName: enterprise.enterpriseName || enterprise.name }
  });
});

// ─── JOBS (Opportunity listings) ─────────────────────────────────────────────
const OPPORTUNITIES = [
  { id: 1, logo: 'A', tag: 'INTERNSHIP', title: 'Frontend Developer Intern', company: 'ABC Technologies', location: 'Remote', duration: '3 Months', match: 91, requiredSkills: ['HTML & CSS', 'Coding (JavaScript)', 'UX/UI Design'] },
  { id: 2, logo: 'X', tag: 'INTERNSHIP', title: 'Python Developer Intern',   company: 'XYZ Solutions',  location: 'Hybrid', duration: '6 Months', match: 86, requiredSkills: ['Coding (Python)', 'SQL & Database Management', 'Machine Learning'] },
  { id: 3, logo: 'D', tag: 'FULL TIME',  title: 'Data Analyst',              company: 'DataWorks',      location: 'Bengaluru', duration: 'Full Time', match: 82, requiredSkills: ['Data Analysis', 'Data Visualization (Tableau, Power BI)', 'Microsoft Excel (Advanced)'] },
  { id: 4, logo: 'S', tag: 'INTERNSHIP', title: 'Full Stack Web Developer',  company: 'SkillSwap Labs', location: 'Remote', duration: '4 Months', match: 94, requiredSkills: ['HTML & CSS', 'Coding (JavaScript)', 'SQL & Database Management'] }
];

app.get('/api/jobs', (req, res) => res.json({ status: 'success', data: OPPORTUNITIES }));

app.post('/api/applications', (req, res) => {
  const { applicantEmail, applicantName, jobTitle } = req.body;
  console.log(`[APPLICATION] ${applicantName || applicantEmail || 'Guest'} → "${jobTitle}"`);
  res.status(201).json({
    status: 'success',
    message: `Application submitted for "${jobTitle}"!`,
    details: { applicant: applicantName || applicantEmail, jobTitle, appliedAt: new Date().toISOString() }
  });
});

// ─── SERVER ───────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;