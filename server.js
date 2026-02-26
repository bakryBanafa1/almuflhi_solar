const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');

const userApp = null; // Removed
const adminApp = null; // Removed
const app = express();

app.use(express.json({ limit: '10mb' }));

// Paths
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const usersPath = path.join(dataDir, 'users.json');
const settingsPath = path.join(dataDir, 'settings.json');
const resultsDir = path.join(dataDir, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

// Initialize Users if not exists
if (!fs.existsSync(usersPath)) {
  fs.writeFileSync(usersPath, JSON.stringify([
    { id: 1, username: 'admin', password: '123', name: 'Admin', isActive: true, canPrint: true }
  ], null, 2));
}

function getUsers() {
  try {
    let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    // Migration: ensure every user has loginCount and isActive
    let changed = false;
    users = users.map(u => {
      if (u.loginCount === undefined) { u.loginCount = 0; changed = true; }
      if (u.isActive === undefined) { u.isActive = true; changed = true; }
      return u;
    });
    if (changed) saveUsers(users);
    return users;
  } catch (e) { return []; }
}

function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// Security & Permissions Logic
const BUNDLED_SECURITY = path.join(__dirname, 'data', 'security.json');
const EXTERNAL_SECURITY = path.join(process.cwd(), 'data', 'security.json');

let SECURITY_CONFIG = {
  whatsapp: true,
  admin: true,
  adminTabs: {
    general: true,
    devices: true,
    solar: true,
    batteries: true,
    theme: true,
    print: true,
    generator: true
  },
  print: true,
  expiration: null // ISO String or null
};

// Load Security Config (Prioritize bundled for generated EXE)
let securityPath = null;
if (fs.existsSync(BUNDLED_SECURITY)) {
  securityPath = BUNDLED_SECURITY;
} else if (fs.existsSync(EXTERNAL_SECURITY)) {
  securityPath = EXTERNAL_SECURITY;
}

if (securityPath) {
  try {
    const savedSec = JSON.parse(fs.readFileSync(securityPath, 'utf8'));
    SECURITY_CONFIG = { ...SECURITY_CONFIG, ...savedSec };
    console.log("Loaded security config from:", securityPath);
  } catch (e) {
    console.error("Failed to load security config", e);
  }
}

// --- Anti-Rollback Time Tracking (Multi-Layered) ---
const TIME_DATA_FILE = path.join(process.cwd(), 'data', 'time.json');
const APPDATA_TIME_FILE = path.join(process.env.APPDATA || '', 'SolarAppMflahi', 'time.json');
const REG_PATH = 'HKCU:\\Software\\SolarAppMflahi';
const REG_NAME = 'LastTime';

let globalMaxSeenTime = 0;

function getStoredMaxTime() {
  let times = [0];

  // 1. Try local data folder
  try {
    if (fs.existsSync(TIME_DATA_FILE)) {
      times.push(JSON.parse(fs.readFileSync(TIME_DATA_FILE, 'utf8')).maxSeenTime || 0);
    }
  } catch (e) { }

  // 2. Try AppData folder
  try {
    if (fs.existsSync(APPDATA_TIME_FILE)) {
      times.push(JSON.parse(fs.readFileSync(APPDATA_TIME_FILE, 'utf8')).maxSeenTime || 0);
    }
  } catch (e) { }

  // 3. Try Registry (Windows Only)
  try {
    const cmd = `powershell -Command "Get-ItemProperty -Path '${REG_PATH}' -Name '${REG_NAME}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ${REG_NAME}"`;
    const result = execSync(cmd).toString().trim();
    if (result) times.push(parseInt(result) || 0);
  } catch (e) { }

  return Math.max(...times);
}

function updateMaxSeenTime() {
  const currentTime = Date.now();
  if (globalMaxSeenTime === 0) {
    globalMaxSeenTime = getStoredMaxTime();
  }

  const newMax = Math.max(currentTime, globalMaxSeenTime);

  // Only write if time has advanced
  if (newMax > globalMaxSeenTime) {
    globalMaxSeenTime = newMax;

    // 1. Write Local
    try {
      const dir = path.dirname(TIME_DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(TIME_DATA_FILE, JSON.stringify({ maxSeenTime: newMax }, null, 2));
    } catch (e) { }

    // 2. Write AppData
    try {
      const dir = path.dirname(APPDATA_TIME_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(APPDATA_TIME_FILE, JSON.stringify({ maxSeenTime: newMax }, null, 2));
    } catch (e) { }

    // 3. Write Registry (Async-ish via spawn to avoid blocking every request too long)
    try {
      const cmd = `if (!(Test-Path '${REG_PATH}')) { New-Item -Path 'HKCU:\\Software' -Name 'SolarAppMflahi' -Force }; New-ItemProperty -Path '${REG_PATH}' -Name '${REG_NAME}' -Value '${newMax}' -PropertyType String -Force`;
      exec(`powershell -Command "${cmd}"`);
    } catch (e) { }
  }

  return globalMaxSeenTime;
}

// Initial sync
globalMaxSeenTime = getStoredMaxTime();
console.log("Anti-Rollback Initialized at:", new Date(globalMaxSeenTime).toLocaleString());

// Check Expiration
function isExpired() {
  if (!SECURITY_CONFIG.expiration) return false;

  // Update and get the "highest" time ever seen by this app on this PC
  const currentMaxTime = updateMaxSeenTime();
  const expDate = new Date(SECURITY_CONFIG.expiration);

  // If the highest time we've ever seen is past the expiration, it's expired.
  // This blocks rollbacks because currentMaxTime will never decrease.
  return currentMaxTime > expDate.getTime();
}

// Middleware for Permissions & Expiration
const securityMiddleware = (req, res, next) => {
  // 0. Expiration Check
  if (isExpired()) {
    if (req.path === '/expired.html') return next();
    if (req.path.match(/\.(css|js|png|jpg|jpeg|ico|json)$/)) return next();

    if (req.path.endsWith('.html') || req.path === '/') {
      return res.send(`
        <div style="direction:rtl; text-align:center; margin-top:15%; font-family:tahoma; padding:20px;">
          <h1 style="color:#d32f2f;">🚫 انتهت صلاحية هذه النسخة</h1>
          <p style="font-size:18px;">عذراً، لقد انتهت الفترة المحددة لاستخدام هذا البرنامج.</p>
          <p style="color:#666;">يرجى التواصل مع مؤسسة ديار المفلحي أو المطور للحصول على تجديد.</p>
          <div style="margin-top:20px; padding:15px; background:#f5f5f5; border-radius:8px; display:inline-block;">
            تاريخ الانتهاء المحدد: ${new Date(SECURITY_CONFIG.expiration).toLocaleDateString('ar-YE')}
          </div>
        </div>
      `);
    }
    return res.status(403).json({ error: 'License Expired' });
  }

  // 1. Admin Block (Legacy check, mostly handled by port separation now)
  if (req.path.startsWith('/admin') || req.path === '/save-settings') {
    if (!SECURITY_CONFIG.admin) {
      return res.status(403).send('Admin access is disabled in this version.');
    }
  }

  // 2. Allow all other requests (Activation removed)
  next();
};

app.use(securityMiddleware);

// Endpoint: System Status (Frontend uses this to hide buttons)
const getSystemStatus = (req, res) => {
  res.json({
    ...SECURITY_CONFIG,
    isExpired: isExpired()
  });
};

app.get('/system-status', getSystemStatus);

// Endpoint: Generate Build (The "Generator")
app.post('/generate-build', async (req, res) => {
  // Only Admin can generate (double check)
  if (!SECURITY_CONFIG.admin) return res.status(403).json({ error: "Access Denied" });

  const { permissions, outputPath } = req.body;
  // permissions: { whatsapp, admin, print, expiration }
  // outputPath: e.g., "D:\\MyClientBuild"

  if (!outputPath) return res.status(400).json({ error: "Output path required" });

  const fsExtra = require('fs'); // We use standard fs, relying on fs.cp (Node 16.7+) or manual copy
  // Note: Node 14 doesn't have fs.cp. Assuming Node 16+ as per pkg target.

  // Config
  const tempBuildDir = path.join(process.cwd(), 'temp_build_' + Date.now());

  try {
    console.log("Starting Generation...");

    // 1. Create Temp Dir
    fs.mkdirSync(tempBuildDir);

    // 2. Recursive Copy (Source -> Temp)
    // Exclude 'data', 'dist', '.git', 'node_modules' (we rely on pkg to traverse requires, but 'public' needs manual copy usually if not required?)
    // Wait, pkg bundles files inside the exe. 
    // We need to copy the *source code* to tempDir, MODIFY security.json, and then run pkg THERE.

    // Helper to copy
    function copyRecursiveSync(src, dest) {
      const exists = fs.existsSync(src);
      const stats = exists && fs.statSync(src);
      const isDirectory = exists && stats.isDirectory();

      if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(childItemName => {
          copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    }

    // We only copy what's needed for the build
    // server.js, package.json, public/
    fs.mkdirSync(path.join(tempBuildDir, 'public'));
    copyRecursiveSync(path.join(__dirname, 'public'), path.join(tempBuildDir, 'public'));

    // Copy node_modules from snapshot to Disk (Crucial for nested pkg builds)
    const nmSrc = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nmSrc)) {
      console.log("Extracting node_modules for standalone build...");
      fs.mkdirSync(path.join(tempBuildDir, 'node_modules'));
      copyRecursiveSync(nmSrc, path.join(tempBuildDir, 'node_modules'));
    }



    fs.copyFileSync(path.join(__dirname, 'server.js'), path.join(tempBuildDir, 'server.js'));
    fs.copyFileSync(path.join(__dirname, 'package.json'), path.join(tempBuildDir, 'package.json'));

    // 3. Create 'data' folder and 'security.json'
    const dataDir = path.join(tempBuildDir, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(permissions, null, 2));

    // 4. Run pkg
    // We assume 'pkg' is globally installed or accessible via npx
    // We will output directly to user's outputPath
    // If outputPath is a folder, we name it 'solar-app.exe'. If it ends in .exe, use it.
    let finalOutput = outputPath;
    if (!finalOutput.endsWith('.exe')) {
      if (!fs.existsSync(finalOutput)) fs.mkdirSync(finalOutput, { recursive: true });
      finalOutput = path.join(finalOutput, 'solar-app.exe');
    } else {
      // Ensure parent dir exists
      const parent = path.dirname(finalOutput);
      if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    }

    const command = `npx pkg . --targets node16-win-x64 --output "${finalOutput}"`;
    console.log("Running:", command);

    await new Promise((resolve, reject) => {
      exec(command, { cwd: tempBuildDir }, (error, stdout, stderr) => {
        if (error) {
          console.error("Pkg Error:", stderr);
          reject(error);
        } else {
          console.log("Pkg Output:", stdout);
          resolve();
        }
      });
    });

    // 5. Cleanup
    // fs.rmSync(tempBuildDir, { recursive: true, force: true });
    // (Keeping it briefly or deleting appropriately)
    // Note: fs.rmSync is Node 14.14+

    console.log("Build Complete:", finalOutput);
    res.json({ ok: true, path: finalOutput });

  } catch (e) {
    console.error("Generation Failed:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- Single Port Routes ---

// 1. Landing Page (Default / via static)
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

// 2. Specific Route Aliases
app.get('/user', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// 3. User API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  let users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    if (!user.isActive) return res.status(403).json({ error: 'حسابك معطل حالياً' });

    // Increment Login Count
    user.loginCount = (user.loginCount || 0) + 1;
    saveUsers(users);

    res.json({ ok: true, user: { id: user.id, username: user.username, canPrint: user.canPrint } });
  } else {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
});

app.post('/save-results', (req, res) => {
  try {
    const data = req.body || {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `result-${timestamp}.json`;
    const fullPath = path.join(resultsDir, fileName);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    res.json({ ok: true, path: fullPath });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/get-settings', (req, res) => {
  const userId = req.query.userId;
  res.json(loadMergedSettings(userId));
});

// 4. Admin API
app.get('/api/users', (req, res) => {
  res.json(getUsers());
});

app.post('/api/users', (req, res) => {
  try {
    const user = req.body;
    let users = getUsers();

    // Ensure numeric ID comparison and storage
    if (user.id) {
      const numericId = parseInt(user.id);
      let found = false;
      users = users.map(u => {
        if (u.id === numericId) {
          found = true;
          return { ...u, ...user, id: numericId }; // Keep ID as number
        }
        return u;
      });
      if (!found) {
        // If ID was provided but not found, maybe it's a new user with a pre-set ID (unlikely) or just push
        users.push({ ...user, id: numericId });
      }
    } else {
      user.id = Date.now();
      users.push(user);
    }

    saveUsers(users);
    res.json({ ok: true });
  } catch (e) {
    console.error("Save User Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  let users = getUsers();
  users = users.filter(u => u.id !== id);
  saveUsers(users);

  // Also delete their custom settings file if it exists
  const userSettingsPath = path.join(dataDir, 'user_settings', `${id}.json`);
  if (fs.existsSync(userSettingsPath)) fs.unlinkSync(userSettingsPath);

  res.json({ ok: true });
});

// Per-User Settings API for Admin
app.get('/api/user-settings/:userId', (req, res) => {
  const userId = req.params.userId;
  const userSettingsPath = path.join(dataDir, 'user_settings', `${userId}.json`);
  if (fs.existsSync(userSettingsPath)) {
    res.json(JSON.parse(fs.readFileSync(userSettingsPath, 'utf8')));
  } else {
    res.json({}); // No custom settings yet
  }
});

app.post('/api/user-settings/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const userSettingsPath = path.join(dataDir, 'user_settings', `${userId}.json`);
    const settingsDir = path.dirname(userSettingsPath);
    if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });

    fs.writeFileSync(userSettingsPath, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/user-settings/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const userSettingsPath = path.join(dataDir, 'user_settings', `${userId}.json`);
    if (fs.existsSync(userSettingsPath)) {
      fs.unlinkSync(userSettingsPath);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function loadMergedSettings(userId = null) {
  let baseSettings = DEFAULT_SETTINGS;

  // 1. Load Global Saved Settings
  if (fs.existsSync(settingsPath)) {
    try {
      const savedGlobal = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      baseSettings = { ...baseSettings, ...savedGlobal };
    } catch (e) { }
  }

  // 2. Load User-Specific Overrides if userId provided
  if (userId) {
    const userSettingsPath = path.join(dataDir, 'user_settings', `${userId}.json`);
    if (fs.existsSync(userSettingsPath)) {
      try {
        const userOverrides = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
        // Deep merge logic or shallow if structure is flat enough
        // For simplicity and based on current app structure, we merge the main categories
        baseSettings = {
          ...baseSettings,
          ...userOverrides,
          companyInfo: { ...baseSettings.companyInfo, ...(userOverrides.companyInfo || {}) },
          deviceConsumption: { ...baseSettings.deviceConsumption, ...(userOverrides.deviceConsumption || {}) },
          solarCalculation: { ...baseSettings.solarCalculation, ...(userOverrides.solarCalculation || {}) },
          themeColors: { ...baseSettings.themeColors, ...(userOverrides.themeColors || {}) },
          printConfig: { ...baseSettings.printConfig, ...(userOverrides.printConfig || {}) },
          prices: { ...baseSettings.prices, ...(userOverrides.prices || {}) },
          panel_names: { ...baseSettings.panel_names, ...(userOverrides.panel_names || {}) }
        };
      } catch (e) { }
    }
  }

  const mergedSettings = baseSettings;

  // Special Handling (Backwards compatibility for snake_case)
  // We use DEFAULT_SETTINGS as reference for keys
  if (!mergedSettings.inverters_load_rules && DEFAULT_SETTINGS.inverters_load_rules) {
    mergedSettings.inverters_load_rules = DEFAULT_SETTINGS.inverters_load_rules;
  }
  if (!mergedSettings.prices && DEFAULT_SETTINGS.prices) {
    mergedSettings.prices = DEFAULT_SETTINGS.prices;
  }
  if (!mergedSettings.panel_names && DEFAULT_SETTINGS.panel_names) {
    mergedSettings.panel_names = DEFAULT_SETTINGS.panel_names;
  }

  // Migration: Ensure all batteries have the "net" field
  if (mergedSettings.batteries) {
    mergedSettings.batteries = mergedSettings.batteries.map((bat, idx) => {
      if (bat.net === undefined) {
        const defBat = DEFAULT_SETTINGS.batteries.find(d => d.id === bat.id) || DEFAULT_SETTINGS.batteries[idx];
        bat.net = defBat ? defBat.net : (bat.capacity ? bat.capacity + " وات" : "-");
      }
      return bat;
    });
  }
  return mergedSettings;
}

app.get('/get-settings', (req, res) => {
  res.json(loadMergedSettings());
});

app.post('/save-settings', (req, res) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Removed duplicate system-status route



// Default Settings for Reset
const DEFAULT_SETTINGS = {
  "companyInfo": {
    "title": "برنامج الطاقة الشمسية - مؤسسة",
    "subtitle": "الطاقة الشمسية - حلول الاقة المتحدة والمستدامة",
    "headerContact": "771627162  | القيم (التاريخ) - بعد محطة السالم وهدفى برزان",
    "whatsappNumber": "967735849775"
  },
  "authConfig": {
    "username": "mm123",
    "password": "123"
  },
  "emailConfig": {
    "serviceId": "service_ajupizq",
    "templateId": "template_z21os4v",
    "userId": "52SYGy0u8F2Givb3L",
    "receiverEmail": "hishambanafa00@gmail.com"
  },
  "deviceConsumption": {
    "lamps": 15,
    "fans": 25,
    "tv": 100,
    "fridge": 140,
    "ac1_day": 1200,
    "ac1_night": 500,
    "ac1_5_day": 1700,
    "ac1_5_night": 800,
    "washing_machine": 500
  },
  "solarCalculation": {
    "peakHours": 6,
    "safetyMargin": 1.3,
    "panelWattages": [
      585,
      645,
      715
    ]
  },
  "prices": {
    "panel_585": 80,
    "panel_645": 90,
    "panel_715": 100
  },
  "panel_names": {
    "panel_585": "لوح 585 كيلو واط3333",
    "panel_645": "لوح 645 واط",
    "panel_715": "لوح 715 واط"
  },
  "inverters": [
    {
      "id": "inv_6k_mmd_v4",
      "name": "جهاز انفرتر 6 كيلو MMD الجيل الرابع",
      "details": "ضمان سنتين",
      "price": 400,
      "max_panels_585": 9,
      "max_panels_645": 8,
      "max_panels_715": 7,
      "max_night_consumption": 8000
    },
    {
      "id": "inv_6k_growatt",
      "name": "جهاز انفرتر 6 كيلو جروات",
      "details": "التفاصيل",
      "price": 430,
      "max_panels_585": 12,
      "max_panels_645": 11,
      "max_panels_715": 9,
      "max_night_consumption": 11400
    },
    {
      "id": "inv_8k_mmd_v5",
      "name": "جهاز انفرتر 8 كيلو MMD الجيل الخامس",
      "details": "ضمان سنتين",
      "price": 850,
      "max_panels_585": 15,
      "max_panels_645": 14,
      "max_panels_715": 12,
      "max_night_consumption": 11400
    },
    {
      "id": "inv_11k_mmd_v5",
      "name": "جهاز انفرتر 11 كيلو MMD الجيل الخامس",
      "details": "ضمان سنتين",
      "price": 950,
      "max_panels_585": 18,
      "max_panels_645": 16,
      "max_panels_715": 15,
      "max_night_consumption": 16000
    },
    {
      "id": "inv_12k_growatt",
      "name": "جهاز انفرتر 12 كيلو جروات",
      "details": "التفاصيل",
      "price": 950,
      "max_panels_585": 22,
      "max_panels_645": 20,
      "max_panels_715": 18,
      "max_night_consumption": 25600
    }
  ],
  "inverters_load_rules": [
    {
      "id": "inv_12k_deye_lv",
      "name": "جهاز انفرتر 12 كيلو Deye سنجل low voltage",
      "details": "التفاصيل",
      "price": 1650,
      "max_panels_585": 32,
      "max_panels_645": 29,
      "max_panels_715": 26,
      "max_night_consumption": 25600,
      "max_hourly_load": 10800
    },
    {
      "id": "inv_16k_deye_lv",
      "name": "جهاز انفرتر 16 كيلو Deye سنجل low voltage",
      "details": "التفاصيل",
      "price": 1950,
      "max_panels_585": 39,
      "max_panels_645": 35,
      "max_panels_715": 32,
      "max_night_consumption": 25600,
      "max_hourly_load": 14400
    },
    {
      "id": "inv_25k_deye_hv",
      "name": "جهاز انفرتر 25 كيلو Deye جهد High Voltage",
      "details": "التفاصيل",
      "price": 2150,
      "max_panels_585": 50,
      "max_panels_645": 45,
      "max_panels_715": 40,
      "max_night_consumption": 48000,
      "max_hourly_load": 22500
    },
    {
      "id": "inv_30k_deye_hv",
      "name": "جهاز انفرتر 30 كيلو Deye جهد High Voltage",
      "details": "التفاصيل",
      "price": 2890,
      "max_panels_585": 73,
      "max_panels_645": 66,
      "max_panels_715": 60,
      "max_night_consumption": 48000,
      "max_hourly_load": 27000
    },
    {
      "id": "inv_40k_deye_hv",
      "name": "جهاز انفرتر 40 كيلو Deye جهد High Voltage",
      "details": "التفاصيل",
      "price": 3800,
      "max_panels_585": 98,
      "max_panels_645": 89,
      "max_panels_715": 80,
      "max_night_consumption": 96000,
      "max_hourly_load": 36000
    },
    {
      "id": "inv_50k_deye_hv",
      "name": "جهاز انفرتر 50 كيلو Deye جهد High Voltage",
      "details": "التفاصيل",
      "price": 4100,
      "max_panels_585": 123,
      "max_panels_645": 111,
      "max_panels_715": 100,
      "max_night_consumption": 96000,
      "max_hourly_load": 45000
    },
    {
      "id": "inv_80k_deye_hv",
      "name": "جهاز انفرتر 80 كيلو Deye جهد High Voltage",
      "details": "التفاصيل",
      "price": 6050,
      "max_panels_585": 196,
      "max_panels_645": 178,
      "max_panels_715": 161,
      "max_night_consumption": 96000,
      "max_hourly_load": 72000
    }
  ],
  "batteries": [
    {
      "id": "bat_5k_mmd_lv",
      "name": "بطارية ليثيوم 5 كيلو نوع MMD ضمان 5 سنوات low voltage",
      "details": "ضمان 5 سنوات استبدال",
      "price": 900,
      "capacity": 5000,
      "min_consumption": 0,
      "max_consumption": 4000,
      "count_modifier": 2,
      "net": "4000 وات"
    },
    {
      "id": "bat_10k_mmd_lv",
      "name": "بطارية ليثيوم 10 كيلو نوع MMD ضمان 5 سنوات low voltage",
      "details": "ضمان 5 سنوات استبدال",
      "price": 1600,
      "capacity": 10000,
      "min_consumption": 4001,
      "max_consumption": 8000,
      "count_modifier": 1,
      "net": "8000 وات"
    },
    {
      "id": "bat_15k_mmd_pro_lv",
      "name": "بطارية ليثيوم 15 كيلو نوع MMD Pro ضمان 5 سنوات low voltage",
      "details": "بنظام أطفاء حرائق داخلي (ضمان 7 سنوات)",
      "price": 1999,
      "capacity": 16380,
      "min_consumption": 8001,
      "max_consumption": 11440,
      "count_modifier": 1,
      "net": "16380 وات"
    },
    {
      "id": "bat_16k_deye_lv",
      "name": "بطارية ليثيوم 16 كيلو نوع Deye ضمان 5 سنوات low voltage",
      "details": "ضمان 5 سنوات استبدال",
      "price": 1650,
      "capacity": 10000,
      "min_consumption": 11441,
      "max_consumption": 12800,
      "count_modifier": 1,
      "net": "10000 وات"
    },
    {
      "id": "bat_20k_mmd_lv",
      "name": "بطارية ليثيوم 20 كيلو نوع MMD ضمان 5 سنوات low voltage",
      "details": "بنظام أطفاء حرائق داخلي (ضمان 7 سنوات)",
      "price": 3100,
      "capacity": 16380,
      "min_consumption": 12800,
      "max_consumption": 16000,
      "count_modifier": 1,
      "net": "16380 وات"
    },
    {
      "id": "bat_30k_mmd_pro_lv",
      "name": "بطارية ليثيوم 30 كيلو نوع MMD Proضمان 5 سنوات low voltage",
      "details": "التفاصيل/الضمان",
      "price": 3950,
      "capacity": 0,
      "min_consumption": 16001,
      "max_consumption": 22880,
      "count_modifier": 1,
      "net": "22880 وات"
    },
    {
      "id": "bat_32k_deye_lv",
      "name": "بطارية ليثيوم 32 كيلو نوع Deye ضمان 5 سنوات low voltage",
      "details": "التفاصيل/الضمان",
      "price": 3200,
      "capacity": 0,
      "min_consumption": 22881,
      "max_consumption": 25600,
      "count_modifier": 1,
      "net": "25600 وات"
    },
    {
      "id": "bank_35k_mmd_hv",
      "name": "بنك طاقة 35 كيلو نوع MMD جهد High Voltage مع RACK و BMS",
      "details": "التفاصيل/الضمان",
      "price": 6550,
      "capacity": 0,
      "min_consumption": 25601,
      "max_consumption": 28000,
      "count_modifier": 1,
      "net": "28000 وات"
    },
    {
      "id": "bank_40k_mmd_hv",
      "name": "بنك طاقة 40 كيلو نوع MMD جهد High Voltage مع RACK و BMS",
      "details": "التفاصيل/الضمان",
      "price": 7350,
      "capacity": 0,
      "min_consumption": 28001,
      "max_consumption": 32000,
      "count_modifier": 1,
      "net": "32000 وات"
    },
    {
      "id": "bank_45k_mmd_hv",
      "name": "بنك طاقة 45 كيلو نوع MMD جهد High Voltage مع RACK و BMS",
      "details": "التفاصيل/الضمان",
      "price": 8150,
      "capacity": 0,
      "min_consumption": 32001,
      "max_consumption": 36000,
      "count_modifier": 1,
      "net": "36000 وات"
    },
    {
      "id": "bank_50k_mmd_hv",
      "name": "بنك طاقة 50 كيلو نوع MMD جهد High Voltage مع RACK و BMS",
      "details": "التفاصيل/الضمان",
      "price": 8950,
      "capacity": 0,
      "min_consumption": 36001,
      "max_consumption": 40000,
      "count_modifier": 1,
      "net": "40000 وات"
    },
    {
      "id": "bank_55k_mmd_hv",
      "name": "بنك طاقة 55 كيلو نوع MMD جهد High Voltage مع RACK و BMS",
      "details": "التفاصيل/الضمان",
      "price": 9750,
      "capacity": 0,
      "min_consumption": 40001,
      "max_consumption": 44000,
      "count_modifier": 1
    },
    {
      "id": "bank_60k_mmd_hv",
      "name": "بنك طاقة 60 كيلو نوع MMD جهد High Voltage مع RACK و BMS",
      "details": "التفاصيل/الضمان",
      "price": 10550,
      "capacity": 0,
      "min_consumption": 44001,
      "max_consumption": 48000,
      "count_modifier": 1
    },
    {
      "id": "bank_65k_mmd_hv",
      "name": "بنك طاقة 65 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 12300,
      "capacity": 0,
      "minConsumption": 48001,
      "maxConsumption": 52000,
      "countModifier": 1
    },
    {
      "id": "bank_70k_mmd_hv",
      "name": "بنك طاقة 70 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 13100,
      "capacity": 0,
      "minConsumption": 52001,
      "maxConsumption": 56000,
      "countModifier": 1
    },
    {
      "id": "bank_75k_mmd_hv",
      "name": "بنك طاقة 75 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 13900,
      "capacity": 0,
      "minConsumption": 56001,
      "maxConsumption": 60000,
      "countModifier": 1
    },
    {
      "id": "bank_80k_mmd_hv",
      "name": "بنك طاقة 80 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 14700,
      "capacity": 0,
      "minConsumption": 60001,
      "maxConsumption": 64000,
      "countModifier": 1
    },
    {
      "id": "bank_85k_mmd_hv",
      "name": "بنك طاقة 85 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 15500,
      "capacity": 0,
      "minConsumption": 64001,
      "maxConsumption": 68000,
      "countModifier": 1
    },
    {
      "id": "bank_90k_mmd_hv",
      "name": "بنك طاقة 90 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 16300,
      "capacity": 0,
      "minConsumption": 68001,
      "maxConsumption": 72000,
      "countModifier": 1
    },
    {
      "id": "bank_95k_mmd_hv",
      "name": "بنك طاقة 95 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 17100,
      "capacity": 0,
      "minConsumption": 72001,
      "maxConsumption": 76000,
      "countModifier": 1
    },
    {
      "id": "bank_100k_mmd_hv",
      "name": "بنك طاقة 100 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 17900,
      "capacity": 0,
      "minConsumption": 76001,
      "maxConsumption": 80000,
      "countModifier": 1
    },
    {
      "id": "bank_105k_mmd_hv",
      "name": "بنك طاقة 105 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 18700,
      "capacity": 0,
      "minConsumption": 80001,
      "maxConsumption": 84000,
      "countModifier": 1
    },
    {
      "id": "bank_110k_mmd_hv",
      "name": "بنك طاقة 110 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 19500,
      "capacity": 0,
      "minConsumption": 84001,
      "maxConsumption": 88000,
      "countModifier": 1
    },
    {
      "id": "bank_115k_mmd_hv",
      "name": "بنك طاقة 115 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 20300,
      "capacity": 0,
      "minConsumption": 88001,
      "maxConsumption": 92000,
      "countModifier": 1
    },
    {
      "id": "bank_120k_mmd_hv",
      "name": "بنك طاقة 120 كيلو نوع MMD جهد High Voltage مع 2RACK و 2BMS",
      "details": "التفاصيل/الضمان",
      "price": 21100,
      "capacity": 0,
      "minConsumption": 92001,
      "maxConsumption": 96000,
      "countModifier": 1
    },
    {
      "id": "engineer_visit",
      "name": "🛑 عزيزي العميل انت بحاجه لنزول مهندس ميداني 🛑",
      "details": "التفاصيل/الضمان",
      "price": 0,
      "capacity": 0,
      "minConsumption": 96001,
      "maxConsumption": 9999999,
      "countModifier": 1
    }
  ],
  "themeColors": {
    "primary": "#2e7d32",
    "primaryLight": "#4caf50",
    "primaryDark": "#1b5e20",
    "background": "#f5f5f5",
    "card": "#ffffff",
    "text": "#333333",
    "border": "#e0e0e0",
    "white": "#ffffff",
    "grayLight": "#f9f9f9",
    "grayMedium": "#eeeeee"
  },
  "printConfig": {
    "headerTitle": "مؤسسة ديار المفلحي للطاقة الشمسية",
    "headerSubtitle": "تقرير المنظومة الشمسية",
    "footerText": "مؤسسة ديار المفلحي للطاقة الشمسية",
    "contactInfo": "هاتف: 771627162 | القيم (التاريخ) - بعد محطة السالم وهدفى برزان",
    "primaryColor": "#2e7d32",
    "textColor": "#333333"
  }
};

app.post('/reset-settings', (req, res) => {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Browse Folder Endpoint (Windows Only)
app.get('/api/browse-folder', (req, res) => {
  // One-liner for shell safety
  const psCommand = "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Output Folder'; $f.ShowNewFolderButton = $true; $result = $f.ShowDialog(); if ($result -eq 'OK') { Write-Output $f.SelectedPath }";

  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "& { ${psCommand} }"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("Browse Error:", stderr || error.message);
      return res.json({ path: '' });
    }
    const selectedPath = stdout.trim();
    console.log("Selected Folder:", selectedPath);
    res.json({ path: selectedPath });
  });
});

// --- Entry Point ---
// --- Entry Point ---
const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
  console.log(`- Landing: http://127.0.0.1:${PORT}/`);
  console.log(`- User:    http://127.0.0.1:${PORT}/user`);
  console.log(`- Admin:   http://127.0.0.1:${PORT}/admin`);

  // Optional: Auto open
  // exec(`start http://127.0.0.1:${PORT}`);
});


