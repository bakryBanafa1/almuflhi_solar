let settings = {};

// Load Settings
async function loadSettings() {
    try {
        const res = await fetch('/get-settings');
        settings = await res.json();
        populateForm(settings);
    } catch (e) {
        console.error("Failed to load settings", e);
        showStatus("فشل تحميل الاعدادات", "error");
    }
}

// --- Layout Helpers ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

function showStatus(msg, type) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.className = 'status-msg status-' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// --- Data Binding ---
function populateForm(data) {
    // Flatten basic fields
    const inputs = document.querySelectorAll('input[name^="companyInfo"], input[name^="authConfig"], input[name^="emailConfig"], input[name^="deviceConsumption"], input[name^="solarCalculation"], input[name^="themeColors"], input[name^="printConfig"]');
    inputs.forEach(input => {
        const parts = input.name.split('.');
        if (data[parts[0]] && data[parts[0]][parts[1]] !== undefined) {
            input.value = data[parts[0]][parts[1]];
        }
    });

    // Complex Arrays (New Mapping with snake_case support)
    renderInverterRules(data.inverters || []);
    renderInverterLoadRules(data.inverters_load_rules || data.invertersLoadRules || []);
    renderBatteryRules(data.batteries || []);
}

// --- Renderers ---
function renderInverterRules(rules) {
    const container = document.getElementById('inverter-rules-container');
    container.innerHTML = '';
    rules.forEach((rule, index) => {
        const div = document.createElement('div');
        div.className = 'array-item';
        div.innerHTML = `
        <button type="button" class="remove-btn" onclick="removeInverterRule(${index})">×</button>
        <h4>أنفرتر ${index + 1}</h4>
        <div class="card-grid">
            <div class="form-group"><label>ID (مميز)</label><input type="text" class="form-control" value="${rule.id || ''}" onchange="updateInverterRule(${index}, 'id', this.value)"></div>
            <div class="form-group"><label>الاسم</label><input type="text" class="form-control" value="${rule.name || ''}" onchange="updateInverterRule(${index}, 'name', this.value)"></div>
            <div class="form-group"><label>السعر ($)</label><input type="number" class="form-control" value="${rule.price || 0}" onchange="updateInverterRule(${index}, 'price', this.value)"></div>
            
            <div class="form-group"><label>Max 585 Panel</label><input type="number" class="form-control" value="${rule.max_panels_585 || rule.maxPanels585 || 0}" onchange="updateInverterRule(${index}, 'max_panels_585', this.value)"></div>
            <div class="form-group"><label>Max 645 Panel</label><input type="number" class="form-control" value="${rule.max_panels_645 || rule.maxPanels645 || 0}" onchange="updateInverterRule(${index}, 'max_panels_645', this.value)"></div>
            <div class="form-group"><label>Max 715 Panel</label><input type="number" class="form-control" value="${rule.max_panels_715 || rule.maxPanels715 || 0}" onchange="updateInverterRule(${index}, 'max_panels_715', this.value)"></div>
            <div class="form-group"><label>Max Night Cons.</label><input type="number" class="form-control" value="${rule.max_night_consumption || rule.maxNightConsumption || 0}" onchange="updateInverterRule(${index}, 'max_night_consumption', this.value)"></div>
            
            <div class="form-group" style="grid-column: span 3;"><label>التفاصيل</label><input type="text" class="form-control" value="${rule.details || ''}" onchange="updateInverterRule(${index}, 'details', this.value)"></div>
        </div>
    `;
        container.appendChild(div);
    });
}

function renderInverterLoadRules(rules) {
    const container = document.getElementById('inverter-load-rules-container');
    container.innerHTML = '';
    rules.forEach((rule, index) => {
        const div = document.createElement('div');
        div.className = 'array-item';
        div.innerHTML = `
        <button type="button" class="remove-btn" onclick="removeInverterLoadRule(${index})">×</button>
        <h4>أنفرتر دايا ${index + 1}</h4>
        <div class="card-grid">
            <div class="form-group"><label>ID</label><input type="text" class="form-control" value="${rule.id || ''}" onchange="updateInverterLoadRule(${index}, 'id', this.value)"></div>
            <div class="form-group"><label>الاسم</label><input type="text" class="form-control" value="${rule.name || ''}" onchange="updateInverterLoadRule(${index}, 'name', this.value)"></div>
            <div class="form-group"><label>السعر ($)</label><input type="number" class="form-control" value="${rule.price || 0}" onchange="updateInverterLoadRule(${index}, 'price', this.value)"></div>
            <div class="form-group"><label>Max Load (Watt)</label><input type="number" class="form-control" value="${rule.max_hourly_load || rule.maxHourlyLoad || 0}" onchange="updateInverterLoadRule(${index}, 'max_hourly_load', this.value)"></div>
            <div class="form-group"><label>Max 585 Panel</label><input type="number" class="form-control" value="${rule.max_panels_585 || rule.maxPanels585 || 0}" onchange="updateInverterLoadRule(${index}, 'max_panels_585', this.value)"></div>
             <div class="form-group"><label>Max Night Cons.</label><input type="number" class="form-control" value="${rule.max_night_consumption || rule.maxNightConsumption || 0}" onchange="updateInverterLoadRule(${index}, 'max_night_consumption', this.value)"></div>
             
            <div class="form-group" style="grid-column: span 3;"><label>التفاصيل</label><input type="text" class="form-control" value="${rule.details || ''}" onchange="updateInverterLoadRule(${index}, 'details', this.value)"></div>
        </div>
    `;
        container.appendChild(div);
    });
}

function renderBatteryRules(rules) {
    const container = document.getElementById('battery-rules-container');
    container.innerHTML = '';
    rules.forEach((rule, index) => {
        const div = document.createElement('div');
        div.className = 'array-item';
        div.innerHTML = `
        <button type="button" class="remove-btn" onclick="removeBatteryRule(${index})">×</button>
        <h4>بطارية ${index + 1}</h4>
        <div class="card-grid">
            <div class="form-group"><label>ID</label><input type="text" class="form-control" value="${rule.id || ''}" onchange="updateBatteryRule(${index}, 'id', this.value)"></div>
            <div class="form-group"><label>الاسم</label><input type="text" class="form-control" value="${rule.name || ''}" onchange="updateBatteryRule(${index}, 'name', this.value)"></div>
            <div class="form-group"><label>السعر ($)</label><input type="number" class="form-control" value="${rule.price || 0}" onchange="updateBatteryRule(${index}, 'price', this.value)"></div>
            
            <div class="form-group"><label>Min Night Cons.</label><input type="number" class="form-control" value="${rule.min_consumption || rule.minConsumption || 0}" onchange="updateBatteryRule(${index}, 'min_consumption', this.value)"></div>
            <div class="form-group"><label>Max Night Cons.</label><input type="number" class="form-control" value="${rule.max_consumption || rule.maxConsumption || 0}" onchange="updateBatteryRule(${index}, 'max_consumption', this.value)"></div>
            
            <div class="form-group"><label>السعة (للعرض)</label><input type="text" class="form-control" value="${rule.capacity || ''}" onchange="updateBatteryRule(${index}, 'capacity', this.value)"></div>
            <div class="form-group"><label>العدد</label><input type="number" class="form-control" value="${rule.count_modifier || rule.countModifier || 1}" onchange="updateBatteryRule(${index}, 'count_modifier', this.value)"></div>
            <div class="form-group" style="grid-column: span 3;"><label>التفاصيل</label><input type="text" class="form-control" value="${rule.details || ''}" onchange="updateBatteryRule(${index}, 'details', this.value)"></div>
        </div>
    `;
        container.appendChild(div);
    });
}

// --- Logic Handlers ---
function updateInverterRule(index, field, value) { settings.inverters[index][field] = value; }
function removeInverterRule(index) { settings.inverters.splice(index, 1); renderInverterRules(settings.inverters); }
function addInverterRule() {
    if (!settings.inverters) settings.inverters = [];
    settings.inverters.push({});
    renderInverterRules(settings.inverters);
}

function updateInverterLoadRule(index, field, value) {
    // Ensure we use the correct array name
    if (!settings.inverters_load_rules) settings.inverters_load_rules = settings.invertersLoadRules || [];
    settings.inverters_load_rules[index][field] = value;
}
function removeInverterLoadRule(index) {
    if (!settings.inverters_load_rules) settings.inverters_load_rules = settings.invertersLoadRules || [];
    settings.inverters_load_rules.splice(index, 1);
    renderInverterLoadRules(settings.inverters_load_rules);
}
function addInverterLoadRule() {
    if (!settings.inverters_load_rules) settings.inverters_load_rules = settings.invertersLoadRules || [];
    settings.inverters_load_rules.push({});
    renderInverterLoadRules(settings.inverters_load_rules);
}

function updateBatteryRule(index, field, value) { settings.batteries[index][field] = value; }
function removeBatteryRule(index) { settings.batteries.splice(index, 1); renderBatteryRules(settings.batteries); }
function addBatteryRule() {
    if (!settings.batteries) settings.batteries = [];
    settings.batteries.push({});
    renderBatteryRules(settings.batteries);
}

// --- Saving ---
async function saveSettings() {
    // Update simple fields from DOM
    const inputs = document.querySelectorAll('input[name^="companyInfo"], input[name^="authConfig"], input[name^="emailConfig"], input[name^="deviceConsumption"], input[name^="solarCalculation"], input[name^="themeColors"], input[name^="printConfig"]');
    inputs.forEach(input => {
        const parts = input.name.split('.');
        // Ensure objects exist
        if (!settings[parts[0]]) settings[parts[0]] = {};

        if (input.type === 'number') {
            settings[parts[0]][parts[1]] = parseFloat(input.value) || 0;
        } else {
            settings[parts[0]][parts[1]] = input.value;
        }
    });

    try {
        const res = await fetch('/save-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        const json = await res.json();
        if (json.ok) {
            showStatus("تم الحفظ بنجاح", "success");
        } else {
            showStatus("حدث خطأ أثناء الحفظ", "error");
        }
    } catch (e) {
        console.error(e);
        showStatus("فشل الاتصال بالخادم", "error");
    }
}

async function resetDefaults() {
    if (!confirm("هل أنت متأكد من استعادة الإعدادات الافتراضية؟ سيتم فقدان جميع التعديلات الحالية.")) {
        return;
    }

    try {
        const res = await fetch('/reset-settings', {
            method: 'POST'
        });
        const json = await res.json();
        if (json.ok) {
            showStatus("تمت استعادة الإعدادات الافتراضية", "success");
            loadSettings(); // Reload settings on page
        } else {
            showStatus("حدث خطأ أثناء الاستعادة", "error");
        }
    } catch (e) {
        console.error(e);
        showStatus("فشل الاتصال بالخادم", "error");
    }
}

// Login Logic
async function checkLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    const loginBtn = document.querySelector('.login-form button');

    loginBtn.textContent = 'جاري التحقق...';
    loginBtn.disabled = true;

    try {
        // Fetch current settings to get latest credentials
        const res = await fetch('/get-settings');
        const currentSettings = await res.json();

        // Default creds if not set
        const configUser = (currentSettings.authConfig && currentSettings.authConfig.username) || 'mm123';
        const configPass = (currentSettings.authConfig && currentSettings.authConfig.password) || '123';

        // Super Admin Credentials
        const superUser = 'hisham';
        const superPass = 'mm123***';

        if ((user === configUser && pass === configPass) || (user === superUser && pass === superPass)) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-container').style.display = 'block';

            // Now populate form with the data we already fetched
            settings = currentSettings;
            populateForm(settings);
        } else {
            errorMsg.style.display = 'block';
        }
    } catch (e) {
        console.error("Login check failed", e);
        errorMsg.textContent = "حدث خطأ في الاتصال، حاول مرة أخرى";
        errorMsg.style.display = 'block';
    } finally {
        loginBtn.textContent = 'دخول';
        loginBtn.disabled = false;
    }
}
