// Global Settings Object
let appSettings = {};

// Default Consumption Values (Fallback)
let DEVICE_CONSUMPTION = {
    lamps: 15,
    fans: 25,
    tv: 100,
    fridge: 140,
    ac1_day: 1200,
    ac1_night: 500,
    ac1_5_day: 1700,
    ac1_5_night: 800,
    washing_machine: 500
};

// إعداد افتراضي لساعات النهار
const DEFAULT_DAY_HOURS = 6;

// إعدادات افتراضية لللمبات والمراوح والغسالة
const LAMPS_DAY_HOURS = 0;
const LAMPS_NIGHT_HOURS = 13;
const FANS_DAY_HOURS = 6;
const FANS_NIGHT_HOURS = 13;
const WASHING_MACHINE_DAY_HOURS = 0;
const WASHING_MACHINE_NIGHT_HOURS = 0;

// الحد الأقصى لساعات المساء
const MAX_NIGHT_HOURS = 13;

// متغير لتخزين الأجهزة الإضافية
let otherDevices = [];

// متغيرات لتخزين النتائج
let currentResults = {
    panels: {},
    inverter: {},
    battery: {},
    totalDayConsumption: 0,
    totalNightConsumption: 0,
    totalHourlyLoad: 0,
    customerInfo: {},
    deviceConsumption: {}
};

// --- Fetch Settings on Load ---
async function loadAppSettings() {
    // 0. Initialize User Display
    const solarUser = JSON.parse(sessionStorage.getItem('solarUser'));
    if (solarUser) {
        if (document.getElementById('current-username')) {
            document.getElementById('current-username').textContent = `مرحباً، ${solarUser.username}`;
        }

        // Apply Per-User Permissions
        const printBtn = document.getElementById('print-btn');
        const pdfBtn = document.getElementById('pdf-btn');
        if (!solarUser.canPrint) {
            if (printBtn) printBtn.style.display = 'none';
            if (pdfBtn) pdfBtn.style.display = 'none';
        }
    }

    try {
        // 1. Fetch Settings
        const responseCallback = await fetch('/get-settings');
        const settings = await responseCallback.json();

        if (settings && Object.keys(settings).length > 0) {
            appSettings = settings;
            applySettings();
        }

        // 2. Fetch System Status (Global Expiration)
        const statusResponse = await fetch('/system-status');
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.isExpired) {
                window.location.href = '/expired.html';
            }
        }

    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

function applySettings() {
    // Apply UI Texts
    if (appSettings.companyInfo) {
        document.title = appSettings.companyInfo.title || document.title;
        if (document.getElementById('app-title')) document.getElementById('app-title').textContent = appSettings.companyInfo.title;
        if (document.getElementById('app-subtitle')) document.getElementById('app-subtitle').textContent = appSettings.companyInfo.subtitle;
        if (document.getElementById('header-contact')) document.getElementById('header-contact').textContent = appSettings.companyInfo.headerContact;
    }

    // Apply EmailJS Config
    if (appSettings.emailConfig && appSettings.emailConfig.userId) {
        emailjs.init(appSettings.emailConfig.userId);
    } else {
        emailjs.init("52SYGy0u8F2Givb3L"); // Fallback
    }

    // Apply Device Consumption
    if (appSettings.deviceConsumption) {
        DEVICE_CONSUMPTION = { ...DEVICE_CONSUMPTION, ...appSettings.deviceConsumption };
    }

    // Apply Theme Colors
    if (appSettings.themeColors) {
        const root = document.documentElement;
        if (appSettings.themeColors.primary) root.style.setProperty('--primary-color', appSettings.themeColors.primary);
        if (appSettings.themeColors.primaryLight) root.style.setProperty('--primary-light', appSettings.themeColors.primaryLight);
        if (appSettings.themeColors.primaryDark) root.style.setProperty('--primary-dark', appSettings.themeColors.primaryDark);
        if (appSettings.themeColors.background) root.style.setProperty('--background-color', appSettings.themeColors.background);
        if (appSettings.themeColors.card) root.style.setProperty('--card-color', appSettings.themeColors.card);
        if (appSettings.themeColors.text) root.style.setProperty('--text-color', appSettings.themeColors.text);
        if (appSettings.themeColors.border) root.style.setProperty('--border-color', appSettings.themeColors.border);
    }

    // Apply Panel Names (UI Labels)
    if (appSettings.panel_names) {
        if (document.getElementById('label-panels-585')) document.getElementById('label-panels-585').textContent = (appSettings.panel_names.panel_585 || '585W') + ':';
        if (document.getElementById('label-panels-645')) document.getElementById('label-panels-645').textContent = (appSettings.panel_names.panel_645 || '645W') + ':';
        if (document.getElementById('label-panels-715')) document.getElementById('label-panels-715').textContent = (appSettings.panel_names.panel_715 || '715W') + ':';
    }
}

// دالة لتحويل الأرقام العربية إلى إنجليزية
function convertArabicToEnglishNumbers(text) {
    if (!text) return text;

    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    let result = text.toString();

    for (let i = 0; i < arabicNumbers.length; i++) {
        const regex = new RegExp(arabicNumbers[i], 'g');
        result = result.replace(regex, englishNumbers[i]);
    }

    return result;
}

// دالة للتحقق من صحة الإدخال وتصحيحه
function validateAndCorrectInput(input) {
    // تحويل الأرقام العربية إلى إنجليزية
    let value = convertArabicToEnglishNumbers(input.value);

    // إزالة أي أحرف غير رقمية باستثناء النقطة
    value = value.replace(/[^\d.]/g, '');

    // التأكد من وجود رقم صالح على الأقل
    if (value === '' || value === '.') {
        value = '0';
    }

    // تحويل إلى رقم والتحقق من النطاق
    let numericValue = parseFloat(value);

    if (isNaN(numericValue)) {
        numericValue = 0;
    }

    // التأكد من أن القيمة بين 0 و 13
    if (numericValue > MAX_NIGHT_HOURS) {
        numericValue = MAX_NIGHT_HOURS;
        showHoursWarningModal();
    }

    if (numericValue < 0) {
        numericValue = 0;
    }

    // تحديث قيمة الحقل بالقيمة المصححة
    input.value = numericValue;

    return numericValue;
}

// التحكم في إظهار/إخفاء الأقسام
const deviceCheckboxes = document.querySelectorAll('input[name="devices"]');

deviceCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
        const sectionId = this.value + '-section';
        const section = document.getElementById(sectionId);

        if (section) {
            section.style.display = this.checked ? 'block' : 'none';

            if (this.value.startsWith('ac') || this.value === 'fridge') {
                createHoursFields(this.value);
            }
        }
    });
});

// إنشاء حقول ساعات المكيفات والثلاجات
function createHoursFields(deviceType) {
    const countInput = document.getElementById(`${deviceType}-count`);
    const container = document.getElementById(`${deviceType}-hours-container`);

    if (countInput && container) {
        countInput.addEventListener('input', function () {
            const count = parseInt(this.value) || 0;
            container.innerHTML = '';

            for (let i = 1; i <= count; i++) {
                const hourItem = document.createElement('div');
                hourItem.className = 'ac-hour-item';
                hourItem.innerHTML = `
                            <span class="ac-hour-label">${getDeviceName(deviceType)} ${i}:</span>
                            <input type="text" class="input-field" placeholder="0" 
                                   id="${deviceType}-night-hours-${i}" style="width: 80px;">
                            <span class="hours-label">ساعة في المساء</span>
                        `;
                container.appendChild(hourItem);

                // إضافة مستمع الحدث لحقل الساعات الجديد
                const hourInput = document.getElementById(`${deviceType}-night-hours-${i}`);
                hourInput.addEventListener('input', handleNightHoursInput);
                hourInput.addEventListener('blur', handleNightHoursInput);
            }
        });
    }
}

// معالجة إدخال ساعات المساء
function handleNightHoursInput(event) {
    validateAndCorrectInput(event.target);
}

// إظهار نافذة تحذير ساعات المساء
function showHoursWarningModal() {
    const warningModal = document.getElementById('hours-warning-modal');
    const warningOkBtn = document.getElementById('hours-warning-ok-btn');

    warningModal.classList.add('show');

    warningOkBtn.onclick = function () {
        warningModal.classList.remove('show');
    };
}

// الحصول على اسم الجهاز بالعربية
function getDeviceName(deviceType) {
    const deviceNames = {
        'ac1': 'مكيف طن',
        'ac1.5': 'مكيف طن ونص',
        'fridge': 'ثلاجة'
    };
    return deviceNames[deviceType] || 'الجهاز';
}

// إخفاء جميع الأقسام الاختيارية في البداية
document.addEventListener('DOMContentLoaded', function () {
    // LOAD SETTINGS FIRST
    loadAppSettings();

    const optionalSections = [
        'lamps-section', 'fans-section', 'tv-section',
        'fridge-section', 'ac1-section', 'ac1.5-section',
        'washing-machine-section', 'other-devices-section'
    ];

    optionalSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    });

    // إضافة مستمعات الأحداث لحقول ساعات المساء الموجودة
    const nightHoursInputs = document.querySelectorAll('input[id$="night-hours"]');
    nightHoursInputs.forEach(input => {
        input.addEventListener('input', handleNightHoursInput);
        input.addEventListener('blur', handleNightHoursInput);
    });

    // إعداد زر إغلاق نافذة الخطأ
    document.getElementById('error-ok-btn').addEventListener('click', function () {
        document.getElementById('error-modal').classList.remove('show');
    });

    // إعداد زر إغلاق نافذة التحذير
    document.getElementById('hours-warning-ok-btn').addEventListener('click', function () {
        document.getElementById('hours-warning-modal').classList.remove('show');
    });

    // إعداد زر الواتساب في قسم النتائج
    document.getElementById('results-whatsapp-btn').addEventListener('click', function () {
        const customerName = currentResults.customerInfo.fullName;
        const whatsappNumber = (appSettings.companyInfo && appSettings.companyInfo.whatsappNumber) ? appSettings.companyInfo.whatsappNumber : '967735849775';
        const whatsappText = `السلام عليكم، أنا ${customerName}. فضلاً أرسل لي المنظومة الشمسية المناسبة`;
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;
        window.open(whatsappUrl, '_blank');
    });

    // إعداد زر PDF في قسم النتائج
    document.getElementById('pdf-btn').addEventListener('click', function () {
        generatePDF();
    });

    // إعداد زر الطباعة العادية
    document.getElementById('print-btn').addEventListener('click', function () {
        printPage();
    });

    // تعيين تاريخ اليوم
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    document.getElementById('order-date').textContent = formattedDate;
});

// إضافة جهاز جديد
document.getElementById('add-device-btn').addEventListener('click', function () {
    const deviceId = 'device-' + Date.now();
    const deviceItem = document.createElement('div');
    deviceItem.className = 'other-device-item';
    deviceItem.id = deviceId;
    deviceItem.innerHTML = `
                <div class="device-header">
                    <div class="device-name">جهاز جديد</div>
                    <button type="button" class="remove-device" onclick="removeOtherDevice('${deviceId}')">حذف</button>
                </div>
                <div class="input-group">
                    <input type="text" class="input-field" placeholder="اسم الجهاز" id="${deviceId}-name" required>
                </div>
                <div class="input-group">
                    <input type="number" class="input-field" placeholder="الاستهلاك بالواط" min="0" id="${deviceId}-wattage" required>
                </div>
                <div class="input-group">
                    <input type="text" class="input-field" placeholder="عدد الساعات في النهار" id="${deviceId}-day-hours" required>
                </div>
                <div class="input-group">
                    <input type="text" class="input-field" placeholder="عدد الساعات في المساء" id="${deviceId}-night-hours" required>
                </div>
            `;
    document.getElementById('other-devices-container').appendChild(deviceItem);

    // إضافة مستمع الحدث لحقول الساعات الجديدة
    const dayHoursInput = document.getElementById(`${deviceId}-day-hours`);
    const nightHoursInput = document.getElementById(`${deviceId}-night-hours`);

    dayHoursInput.addEventListener('input', function () {
        validateAndCorrectInput(this);
    });
    dayHoursInput.addEventListener('blur', function () {
        validateAndCorrectInput(this);
    });

    nightHoursInput.addEventListener('input', function () {
        validateAndCorrectInput(this);
    });
    nightHoursInput.addEventListener('blur', function () {
        validateAndCorrectInput(this);
    });
});

// حذف جهاز إضافي
window.removeOtherDevice = function (deviceId) {
    const deviceElement = document.getElementById(deviceId);
    if (deviceElement) {
        deviceElement.remove();
    }
};

// معالجة إرسال النموذج
document.getElementById('solar-system-form').addEventListener('submit', function (e) {
    e.preventDefault();

    if (!validateAllRequiredFields()) {
        showErrorModal('يرجى ملء جميع الحقول المطلوبة (الاسم الأول، الاسم الأخير، رقم التواصل، المنطقة).');
        return;
    }

    // التحقق من وجود أجهزة محددة
    if (!hasSelectedDevices()) {
        showErrorModal('يرجى تحديد الأجهزة التي تريد تشغيلها على المنظومة الشمسية قبل الحساب.');
        return;
    }

    // التحقق من أن الأجهزة المحددة تحتوي على بيانات
    if (!hasValidDeviceData()) {
        showErrorModal('يرجى ملء بيانات الأجهزة المحددة (العدد وساعات التشغيل).');
        return;
    }

    calculateConsumption();
});

// دالة التحقق من وجود أجهزة محددة
function hasSelectedDevices() {
    const deviceCheckboxes = document.querySelectorAll('input[name="devices"]:checked');
    return deviceCheckboxes.length > 0;
}

// دالة التحقق من صحة بيانات الأجهزة
function hasValidDeviceData() {
    const deviceCheckboxes = document.querySelectorAll('input[name="devices"]:checked');

    for (let checkbox of deviceCheckboxes) {
        const deviceType = checkbox.value;

        // التحقق من الأجهزة الأساسية
        if (deviceType !== 'other-devices') {
            const countInput = document.getElementById(`${deviceType}-count`);
            if (countInput && (!countInput.value || parseInt(countInput.value) === 0)) {
                return false;
            }

            // التحقق من ساعات التشغيل للأجهزة التي تحتاجها
            if (deviceType === 'tv') {
                const nightHours = document.getElementById('tv-night-hours');
                if (!nightHours.value || parseFloat(nightHours.value) === 0) {
                    return false;
                }
            }
        }
    }

    // التحقق من الأجهزة الإضافية
    if (document.getElementById('other-devices-check')?.checked) {
        const otherDeviceItems = document.querySelectorAll('.other-device-item');
        if (otherDeviceItems.length === 0) {
            return false;
        }

        for (let item of otherDeviceItems) {
            const deviceId = item.id;
            const name = document.getElementById(`${deviceId}-name`)?.value;
            const wattage = document.getElementById(`${deviceId}-wattage`)?.value;
            const dayHours = document.getElementById(`${deviceId}-day-hours`)?.value;
            const nightHours = document.getElementById(`${deviceId}-night-hours`)?.value;

            if (!name || !wattage || !dayHours || !nightHours ||
                parseInt(wattage) === 0 || (parseFloat(dayHours) === 0 && parseFloat(nightHours) === 0)) {
                return false;
            }
        }
    }

    return true;
}

// دالة إظهار نافذة الخطأ
function showErrorModal(message) {
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');

    errorMessage.textContent = message;
    errorModal.classList.add('show');
}

// دالة حساب عدد الألواح الشمسية لكل نوع
function calculateSolarPanels(dayConsumption, nightConsumption) {

    // Use settings or fallback
    const peakHours = (appSettings.solarCalculation && appSettings.solarCalculation.peakHours) ? appSettings.solarCalculation.peakHours : 6;
    const safetyMargin = (appSettings.solarCalculation && appSettings.solarCalculation.safetyMargin) ? appSettings.solarCalculation.safetyMargin : 1.3;

    // Panel Wattages
    // Fallback: 585, 645, 715
    const panelPower585 = 585;
    const panelPower645 = 645;
    const panelPower715 = 715;

    dayConsumption = dayConsumption || 0;
    nightConsumption = nightConsumption || 0;

    const totalConsumption = dayConsumption + nightConsumption;

    // حساب عدد الألواح لكل نوع مع التقريب الرياضي
    const panels585 = Math.round((totalConsumption * safetyMargin) / (panelPower585 * peakHours));
    const panels645 = Math.round((totalConsumption * safetyMargin) / (panelPower645 * peakHours));
    const panels715 = Math.round((totalConsumption * safetyMargin) / (panelPower715 * peakHours));

    // التأكد من أن العدد لا يقل عن 1 إذا كان هناك استهلاك
    const minPanels = (totalConsumption > 0) ? 1 : 0;

    return {
        panels585: Math.max(panels585, minPanels),
        panels645: Math.max(panels645, minPanels),
        panels715: Math.max(panels715, minPanels),
        total: Math.max(panels585, minPanels) + Math.max(panels645, minPanels) + Math.max(panels715, minPanels)
    };
}

// دالة تحديد حجم الأنفرتر
// دالة تحديد حجم الأنفرتر
function getInverterSize(panels, totalHourlyLoad, nightConsumption) {
    const { panels585, panels645, panels715 } = panels;
    nightConsumption = nightConsumption || 0;

    let validInverters = [];

    // 1. Check Inverter Load Rules (e.g., Daya, High Load)
    const loadRules = appSettings.inverters_load_rules || appSettings.invertersLoadRules;
    if (loadRules && loadRules.length > 0) {
        for (let rule of loadRules) {
            // Normalize snake_case / camelCase
            const maxHourly = rule.max_hourly_load !== undefined ? rule.max_hourly_load : rule.maxHourlyLoad;
            const maxPanels585 = rule.max_panels_585 !== undefined ? rule.max_panels_585 : rule.maxPanels585;
            const maxNight = rule.max_night_consumption !== undefined ? rule.max_night_consumption : rule.maxNightConsumption;

            // Check if valid
            if (totalHourlyLoad <= maxHourly &&
                panels585 <= maxPanels585 &&
                nightConsumption <= maxNight) {

                validInverters.push({
                    type: rule.type || rule.name,
                    brand: rule.brand || "",
                    warranty: rule.warranty || "",
                    details: rule.details,
                    hourlyLoad: totalHourlyLoad,
                    price: rule.price,
                    name: rule.name,
                    source: 'load_rule'
                });
            }
        }
    }

    // 2. Check Panel Count Rules (e.g., Voltronic/MMD, Standard)
    if (appSettings.inverters && appSettings.inverters.length > 0) {
        for (let rule of appSettings.inverters) {
            const maxPanels585 = rule.max_panels_585 !== undefined ? rule.max_panels_585 : rule.maxPanels585;
            const maxPanels645 = rule.max_panels_645 !== undefined ? rule.max_panels_645 : rule.maxPanels645;
            const maxPanels715 = rule.max_panels_715 !== undefined ? rule.max_panels_715 : rule.maxPanels715;
            const maxNight = rule.max_night_consumption !== undefined ? rule.max_night_consumption : rule.maxNightConsumption;

            if (panels585 <= maxPanels585 &&
                panels645 <= maxPanels645 &&
                panels715 <= maxPanels715 &&
                nightConsumption <= maxNight) {

                validInverters.push({
                    type: rule.type || rule.name,
                    brand: rule.brand || "",
                    warranty: rule.warranty || "",
                    details: rule.details,
                    hourlyLoad: totalHourlyLoad,
                    price: rule.price,
                    name: rule.name,
                    source: 'panel_rule'
                });
            }
        }
    }

    // 3. Select the best inverter (Cheapest)
    if (validInverters.length > 0) {
        // Sort by Price Ascending
        validInverters.sort((a, b) => a.price - b.price);
        return validInverters[0];
    }

    // Fallback
    return {
        type: "يحتاج دراسة خاصة",
        brand: "غير محدد",
        warranty: "غير محدد",
        details: `الأحمال (${totalHourlyLoad} واط) أو الاستهلاك الليلي (${nightConsumption} واط) يتجاوز الحدود - يرجى التواصل للمشورة`,
        hourlyLoad: totalHourlyLoad,
        price: 0,
        name: "يحتاج دراسة خاصة"
    };
}

// دالة تحديد حجم البطارية المحدثة
function getBatterySize(nightConsumption) {
    const watt = Math.round(nightConsumption);

    // Use settings if available
    if (appSettings.batteries && appSettings.batteries.length > 0) {
        for (let rule of appSettings.batteries) {
            const minCons = rule.min_consumption !== undefined ? rule.min_consumption : rule.minConsumption;
            const maxCons = rule.max_consumption !== undefined ? rule.max_consumption : rule.maxConsumption;
            const countMod = rule.count_modifier !== undefined ? rule.count_modifier : (rule.countModifier || 1);

            if (watt >= minCons && watt <= maxCons) {
                return {
                    type: rule.type || rule.name,
                    brand: rule.brand || "",
                    capacity: rule.capacity,
                    count: countMod,
                    warranty: rule.warranty || "",
                    specs: rule.details,
                    net: rule.net || (rule.capacity ? rule.capacity + " وات" : "-"),
                    nightConsumption: watt,
                    price: rule.price,
                    name: rule.name,
                    id: rule.id
                };
            }
        }
    }

    // Default Fallback
    return {
        type: "يحتاج دراسة خاصة",
        brand: "غير محدد",
        capacity: "غير محدد",
        count: 0,
        warranty: "غير محدد",
        specs: "استهلاك الليل يتجاوز الحدود المعتادة",
        nightConsumption: watt,
        price: 0,
        name: "يحتاج دراسة خاصة"
    };
}

// دالة حساب الاستهلاك
function calculateConsumption() {
    let totalDayConsumption = 0;
    let totalNightConsumption = 0;
    let deviceConsumptionDetails = {};

    console.log("بدء حساب الاستهلاك...");

    // جمع معلومات العميل
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phone = document.getElementById('phone').value;
    const region = document.getElementById('region').value;

    currentResults.customerInfo = {
        firstName,
        lastName,
        phone,
        region,
        fullName: `${firstName} ${lastName}`
    };

    // حساب استهلاك اللمبات
    if (document.getElementById('lamps-check')?.checked) {
        const count = parseInt(document.getElementById('lamps-count')?.value) || 0;
        if (count > 0) {
            const dayConsumption = count * DEVICE_CONSUMPTION.lamps * LAMPS_DAY_HOURS;
            const nightConsumption = count * DEVICE_CONSUMPTION.lamps * LAMPS_NIGHT_HOURS;
            totalDayConsumption += dayConsumption;
            totalNightConsumption += nightConsumption;

            deviceConsumptionDetails.lamps = {
                name: 'لمبات',
                count: count,
                dayHours: LAMPS_DAY_HOURS,
                nightHours: LAMPS_NIGHT_HOURS,
                dayConsumption: dayConsumption,
                nightConsumption: nightConsumption,
                totalConsumption: dayConsumption + nightConsumption
            };
        }
    }

    // حساب استهلاك المراوح
    if (document.getElementById('fans-check')?.checked) {
        const count = parseInt(document.getElementById('fans-count')?.value) || 0;
        if (count > 0) {
            const dayConsumption = count * DEVICE_CONSUMPTION.fans * FANS_DAY_HOURS;
            const nightConsumption = count * DEVICE_CONSUMPTION.fans * FANS_NIGHT_HOURS;
            totalDayConsumption += dayConsumption;
            totalNightConsumption += nightConsumption;

            deviceConsumptionDetails.fans = {
                name: 'مراوح',
                count: count,
                dayHours: FANS_DAY_HOURS,
                nightHours: FANS_NIGHT_HOURS,
                dayConsumption: dayConsumption,
                nightConsumption: nightConsumption,
                totalConsumption: dayConsumption + nightConsumption
            };
        }
    }

    // حساب استهلاك الشاشات
    if (document.getElementById('tv-check')?.checked) {
        const count = parseInt(document.getElementById('tv-count')?.value) || 0;
        const nightHoursInput = document.getElementById('tv-night-hours');
        const nightHours = validateAndCorrectInput(nightHoursInput);
        if (count > 0 && nightHours > 0) {
            const dayConsumption = count * DEVICE_CONSUMPTION.tv * DEFAULT_DAY_HOURS;
            const nightConsumption = count * DEVICE_CONSUMPTION.tv * nightHours;
            totalDayConsumption += dayConsumption;
            totalNightConsumption += nightConsumption;

            deviceConsumptionDetails.tv = {
                name: 'شاشات',
                count: count,
                dayHours: DEFAULT_DAY_HOURS,
                nightHours: nightHours,
                dayConsumption: dayConsumption,
                nightConsumption: nightConsumption,
                totalConsumption: dayConsumption + nightConsumption
            };
        }
    }

    // حساب استهلاك الغسالة
    if (document.getElementById('washing-machine-check')?.checked) {
        const count = parseInt(document.getElementById('washing-machine-count')?.value) || 0;
        if (count > 0) {
            const dayConsumption = count * DEVICE_CONSUMPTION.washing_machine * WASHING_MACHINE_DAY_HOURS;
            const nightConsumption = count * DEVICE_CONSUMPTION.washing_machine * WASHING_MACHINE_NIGHT_HOURS;
            totalDayConsumption += dayConsumption;
            totalNightConsumption += nightConsumption;

            deviceConsumptionDetails.washing_machine = {
                name: 'غسالات',
                count: count,
                dayHours: WASHING_MACHINE_DAY_HOURS,
                nightHours: WASHING_MACHINE_NIGHT_HOURS,
                dayConsumption: dayConsumption,
                nightConsumption: nightConsumption,
                totalConsumption: dayConsumption + nightConsumption
            };
        }
    }

    // حساب استهلاك الثلاجات
    if (document.getElementById('fridge-check')?.checked) {
        const count = parseInt(document.getElementById('fridge-count')?.value) || 0;
        if (count > 0) {
            let totalNightHours = 0;
            let validFridges = 0;

            for (let i = 1; i <= count; i++) {
                const nightHoursInput = document.getElementById(`fridge-night-hours-${i}`);
                if (nightHoursInput) {
                    const nightHours = validateAndCorrectInput(nightHoursInput);
                    if (nightHours > 0) {
                        totalNightHours += nightHours;
                        validFridges++;
                    }
                }
            }

            if (validFridges > 0) {
                const avgNightHours = totalNightHours / validFridges;
                const dayConsumption = count * DEVICE_CONSUMPTION.fridge * DEFAULT_DAY_HOURS;
                const nightConsumption = count * DEVICE_CONSUMPTION.fridge * avgNightHours;
                totalDayConsumption += dayConsumption;
                totalNightConsumption += nightConsumption;

                deviceConsumptionDetails.fridge = {
                    name: 'ثلاجات',
                    count: count,
                    dayHours: DEFAULT_DAY_HOURS,
                    nightHours: avgNightHours,
                    dayConsumption: dayConsumption,
                    nightConsumption: nightConsumption,
                    totalConsumption: dayConsumption + nightConsumption
                };
            }
        }
    }

    // حساب استهلاك مكيف طن
    if (document.getElementById('ac1-check')?.checked) {
        const count = parseInt(document.getElementById('ac1-count')?.value) || 0;
        if (count > 0) {
            let totalNightHours = 0;
            let validACs = 0;

            for (let i = 1; i <= count; i++) {
                const nightHoursInput = document.getElementById(`ac1-night-hours-${i}`);
                if (nightHoursInput) {
                    const nightHours = validateAndCorrectInput(nightHoursInput);
                    if (nightHours > 0) {
                        totalNightHours += nightHours;
                        validACs++;
                    }
                }
            }

            if (validACs > 0) {
                const avgNightHours = totalNightHours / validACs;
                const dayConsumption = count * DEVICE_CONSUMPTION.ac1_day * DEFAULT_DAY_HOURS;
                const nightConsumption = count * DEVICE_CONSUMPTION.ac1_night * avgNightHours;
                totalDayConsumption += dayConsumption;
                totalNightConsumption += nightConsumption;

                deviceConsumptionDetails.ac1 = {
                    name: 'مكيف طن',
                    count: count,
                    dayHours: DEFAULT_DAY_HOURS,
                    nightHours: avgNightHours,
                    dayConsumption: dayConsumption,
                    nightConsumption: nightConsumption,
                    totalConsumption: dayConsumption + nightConsumption
                };
            }
        }
    }

    // حساب استهلاك مكيف طن ونص
    if (document.getElementById('ac1.5-check')?.checked) {
        const count = parseInt(document.getElementById('ac1.5-count')?.value) || 0;
        if (count > 0) {
            let totalNightHours = 0;
            let validACs = 0;

            for (let i = 1; i <= count; i++) {
                const nightHoursInput = document.getElementById(`ac1.5-night-hours-${i}`);
                if (nightHoursInput) {
                    const nightHours = validateAndCorrectInput(nightHoursInput);
                    if (nightHours > 0) {
                        totalNightHours += nightHours;
                        validACs++;
                    }
                }
            }

            if (validACs > 0) {
                const avgNightHours = totalNightHours / validACs;
                const dayConsumption = count * DEVICE_CONSUMPTION.ac1_5_day * DEFAULT_DAY_HOURS;
                const nightConsumption = count * DEVICE_CONSUMPTION.ac1_5_night * avgNightHours;
                totalDayConsumption += dayConsumption;
                totalNightConsumption += nightConsumption;

                deviceConsumptionDetails.ac1_5 = {
                    name: 'مكيف طن ونص',
                    count: count,
                    dayHours: DEFAULT_DAY_HOURS,
                    nightHours: avgNightHours,
                    dayConsumption: dayConsumption,
                    nightConsumption: nightConsumption,
                    totalConsumption: dayConsumption + nightConsumption
                };
            }
        }
    }

    // حساب استهلاك الأجهزة الإضافية
    if (document.getElementById('other-devices-check')?.checked) {
        const otherDeviceItems = document.querySelectorAll('.other-device-item');
        otherDeviceItems.forEach(item => {
            const deviceId = item.id;
            const name = document.getElementById(`${deviceId}-name`)?.value || 'جهاز آخر';
            const wattage = parseInt(document.getElementById(`${deviceId}-wattage`)?.value) || 0;
            const dayHoursInput = document.getElementById(`${deviceId}-day-hours`);
            const nightHoursInput = document.getElementById(`${deviceId}-night-hours`);

            const dayHours = dayHoursInput ? validateAndCorrectInput(dayHoursInput) : 0;
            const nightHours = nightHoursInput ? validateAndCorrectInput(nightHoursInput) : 0;

            if (wattage > 0 && (dayHours > 0 || nightHours > 0)) {
                const dayConsumption = wattage * dayHours;
                const nightConsumption = wattage * nightHours;
                totalDayConsumption += dayConsumption;
                totalNightConsumption += nightConsumption;

                deviceConsumptionDetails[deviceId] = {
                    name: name,
                    count: 1,
                    dayHours: dayHours,
                    nightHours: nightHours,
                    dayConsumption: dayConsumption,
                    nightConsumption: nightConsumption,
                    totalConsumption: dayConsumption + nightConsumption
                };
            }
        });
    }

    console.log(`الاستهلاك النهاري: ${totalDayConsumption}`);
    console.log(`الاستهلاك المسائي: ${totalNightConsumption}`);

    // إذا لم يكن هناك استهلاك، نوقف العملية
    if (totalDayConsumption === 0 && totalNightConsumption === 0) {
        showErrorModal('لم يتم تحديد أي أجهزة صالحة للحساب. يرجى التأكد من ملء جميع البيانات المطلوبة.');
        return;
    }

    // حساب إجمالي الأحمال في الساعة
    const totalHourlyLoad = calculateHourlyLoad(deviceConsumptionDetails);

    // الحسابات الجديدة للمنظومة
    const panelsResult = calculateSolarPanels(totalDayConsumption, totalNightConsumption);
    const inverter = getInverterSize(panelsResult, totalHourlyLoad, totalNightConsumption);
    const battery = getBatterySize(totalNightConsumption);

    console.log("عدد الألواح 585 واط:", panelsResult.panels585);
    console.log("عدد الألواح 645 واط:", panelsResult.panels645);
    console.log("عدد الألواح 715 واط:", panelsResult.panels715);
    console.log("الأنفرتر:", inverter);
    console.log("البطارية:", battery);
    console.log("إجمالي الأحمال في الساعة:", totalHourlyLoad);

    // تخزين النتائج
    currentResults.panels = panelsResult;
    currentResults.inverter = inverter;
    currentResults.battery = battery;
    currentResults.totalDayConsumption = totalDayConsumption;
    currentResults.totalNightConsumption = totalNightConsumption;
    currentResults.totalHourlyLoad = totalHourlyLoad;
    currentResults.deviceConsumption = deviceConsumptionDetails;

    // عرض النتائج في الصفحة
    displayResults();

    // إرسال البريد الإلكتروني
    sendEmail();
}

// دالة لعرض النتائج في الصفحة
function displayResults() {
    // تحديث معلومات العميل
    document.getElementById('customer-name').textContent = currentResults.customerInfo.fullName;
    document.getElementById('customer-phone').textContent = currentResults.customerInfo.phone;
    document.getElementById('customer-region').textContent = currentResults.customerInfo.region;

    // تحديث جدول الاستهلاك
    const consumptionDetails = document.getElementById('consumption-details');
    consumptionDetails.innerHTML = '';

    Object.values(currentResults.deviceConsumption).forEach(device => {
        const row = document.createElement('tr');
        row.innerHTML = `
                    <td>${device.name}</td>
                    <td>${device.count}</td>
                    <td>${device.dayHours.toFixed(1)}</td>
                    <td>${device.nightHours.toFixed(1)}</td>
                    <td>${Math.round(device.dayConsumption)}</td>
                    <td>${Math.round(device.nightConsumption)}</td>
                    <td>${Math.round(device.totalConsumption)}</td>
                `;
        consumptionDetails.appendChild(row);
    });

    // تحديث المجاميع
    document.getElementById('total-day-consumption').textContent = Math.round(currentResults.totalDayConsumption);
    document.getElementById('total-night-consumption').textContent = Math.round(currentResults.totalNightConsumption);
    document.getElementById('total-consumption').textContent = Math.round(currentResults.totalDayConsumption + currentResults.totalNightConsumption);

    // تحديث بيانات الألواح الشمسية
    // تحديث بيانات الألواح الشمسية
    //document.getElementById('panels-total').textContent = currentResults.panels.total;
    document.getElementById('panels-585').textContent = currentResults.panels.panels585;
    document.getElementById('panels-645').textContent = currentResults.panels.panels645;
    document.getElementById('panels-715').textContent = currentResults.panels.panels715;
    document.getElementById('panels-type').textContent = `ألواح شمسية متعددة الأنواع`;

    // تحديث بيانات الأنفرتر
    document.getElementById('inverter-type').textContent = `${currentResults.inverter.type} ${currentResults.inverter.brand}`;
    document.getElementById('inverter-warranty').textContent = currentResults.inverter.warranty;
    document.getElementById('inverter-hourly-consumption').textContent = `${currentResults.totalHourlyLoad} واط/ساعة`;

    // تحديث بيانات البطارية
    document.getElementById('battery-type').textContent = currentResults.battery.type;
    document.getElementById('battery-net').textContent = currentResults.battery.net || '-';
    document.getElementById('battery-specs').textContent = currentResults.battery.specs;
    document.getElementById('battery-warranty').textContent = currentResults.battery.warranty;
    document.getElementById('battery-count').textContent = currentResults.battery.count > 0 ? currentResults.battery.count : '-';
    document.getElementById('battery-night-consumption').textContent = `${Math.round(currentResults.totalNightConsumption)} واط`;

    // إظهار قسم النتائج
    document.getElementById('results-section').classList.add('show');

    // التمرير إلى قسم النتائج
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

// دالة إرسال البريد الإلكتروني باستخدام EmailJS
function sendEmail() {
    // إنشاء قائمة الأجهزة كنصوص بسيطة
    let devicesListHTML = '';

    Object.values(currentResults.deviceConsumption).forEach(device => {
        devicesListHTML += `
                    ${device.name}:
                    - العدد: ${device.count}
                    - ساعات النهار: ${device.dayHours.toFixed(1)} ساعة
                    - ساعات المساء: ${device.nightHours.toFixed(1)} ساعة
                    - استهلاك النهار: ${Math.round(device.dayConsumption)} واط
                    - استهلاك المساء: ${Math.round(device.nightConsumption)} واط
                    - الإجمالي: ${Math.round(device.totalConsumption)} واط
                    
                `;
    });

    if (devicesListHTML === '') {
        devicesListHTML = 'لا توجد أجهزة محددة';
    }

    const totalDailyConsumption = Math.round(currentResults.totalDayConsumption + currentResults.totalNightConsumption);

    const receiverEmail = (appSettings.emailConfig && appSettings.emailConfig.receiverEmail) ? appSettings.emailConfig.receiverEmail : 'hishambanafa00@gmail.com';

    const templateParams = {
        to_email: receiverEmail,
        from_name: (appSettings.companyInfo && appSettings.companyInfo.title) ? appSettings.companyInfo.title : 'مؤسسة ديار المفلحي للطاقة الشمسية',
        customer_name: currentResults.customerInfo.fullName,
        customer_phone: currentResults.customerInfo.phone,
        customer_region: currentResults.customerInfo.region,
        panels_count: currentResults.panels.total,
        panels_type: `لوح شمسي ${currentResults.panels.panels645 > 0 ? '645' : currentResults.panels.panels585 > 0 ? '585' : '715'} واط لكم وجهين`,
        inverter_type: `${currentResults.inverter.type} ${currentResults.inverter.brand}`,
        inverter_warranty: currentResults.inverter.warranty,
        inverter_hourly_consumption: `${currentResults.totalHourlyLoad} واط/ساعة`,
        battery_type: currentResults.battery.type,
        battery_specs: `${currentResults.battery.specs} - الصافي: ${currentResults.battery.net || '-'}`,
        battery_warranty: currentResults.battery.warranty,
        battery_count: currentResults.battery.count > 0 ? `العدد: ${currentResults.battery.count}` : '',
        battery_night_consumption: `${Math.round(currentResults.totalNightConsumption)} واط`,
        total_day_consumption: Math.round(currentResults.totalDayConsumption),
        total_night_consumption: Math.round(currentResults.totalNightConsumption),
        total_daily_consumption: totalDailyConsumption,
        devices_list: devicesListHTML,
        date: new Date().toLocaleDateString('en-US')
    };

    console.log('إرسال البريد الإلكتروني بالبيانات:', templateParams);

    const serviceId = (appSettings.emailConfig && appSettings.emailConfig.serviceId) ? appSettings.emailConfig.serviceId : 'service_ajupizq';
    const templateId = (appSettings.emailConfig && appSettings.emailConfig.templateId) ? appSettings.emailConfig.templateId : 'template_z21os4v';

    // إرسال البريد باستخدام EmailJS
    emailjs.send(serviceId, templateId, templateParams)
        .then(function (response) {
            console.log('SUCCESS!', response.status, response.text);
        }, function (error) {
            console.log('FAILED...', error);
        });
}

// دالة بديلة لطباعة الصفحة مباشرة
// دالة بديلة لطباعة الصفحة مباشرة - محسنة
function printPage() {
    // حفظ حالة العرض الحالية
    const resultsSection = document.getElementById('results-section');
    const originalDisplay = resultsSection.style.display;

    // إظهار قسم النتائج إذا كان مخفياً
    resultsSection.style.display = 'block';
    resultsSection.classList.add('show');

    // إنشاء محتوى طباعة متعدد الصفحات
    const printContent = document.getElementById('results-section').innerHTML;

    // فتح نافذة طباعة جديدة
    const printWindow = window.open('', '_blank');

    // إنشاء محتوى HTML للنافذة مع دعم الصفحات المتعددة
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير المنظومة الشمسية - ${currentResults.customerInfo.fullName}</title>
            <style>
                @media print {
                    body {
                        font-family: 'Arial', 'Segoe UI', sans-serif;
                        margin: 0;
                        padding: 20px;
                        font-size: 11pt;
                        line-height: 1.4;
                    }
                    
                    @page {
                        size: A4;
                        margin: 1.5cm;
                    }
                    
                    @page :first {
                        margin-top: 2cm;
                    }
                    
                    .page-break {
                        page-break-before: always;
                        margin-top: 2cm;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        font-size: 9pt;
                        page-break-inside: avoid;
                        direction: rtl;
                    }
                    
                    th, td {
                        border: 1px solid #000;
                        padding: 4px;
                        text-align: center;
                        color: #000;
                    }
                    
                    th {
                        background: transparent;
                        color: #000;
                        font-weight: bold;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #2e7d32;
                    }
                    
                    .header h1 {
                        color: #2e7d32;
                        margin: 0 0 5px 0;
                    }
                    
                    .customer-info {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid #000;
                        padding: 10px 0;
                        margin: 10px 0 20px 0;
                        flex-wrap: wrap;
                    }
                    
                    .customer-info p {
                        margin: 0;
                        padding: 0 10px;
                        font-weight: bold;
                    }
                    
                    .components-container {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                        margin: 20px 0;
                        page-break-inside: avoid;
                    }
                    
                    .component {
                        border: 1px solid #ddd;
                        padding: 10px;
                        border-radius: 4px;
                    }
                    

                    .footer {
                        margin-top: 10px;
                        padding-top: 5px;
                        text-align: center;
                        font-size: 8pt;
                        color: #888;
                        border-top: 1px solid #f5f5f5;
                    }
                    
                    /* تجنب تقسيم الصفوف في الجدول */
                    tr {
                        page-break-inside: avoid;
                    }
                    
                    /* تجنب العناوين في نهاية الصفحة */
                    h2, h3 {
                        page-break-after: avoid;
                    }
                }
                
                @media screen {
                    body {
                        padding: 20px;
                        font-family: Arial, sans-serif;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>مؤسسة ديار المفلحي للطاقة الشمسية</h1>
                <p>771627162 ▼ | القيم (التاريخ) - بعد محطة السالم وهدفى برزان</p>
            </div>
            
            <div class="customer-info">
                <p><strong>الاسم:</strong> ${currentResults.customerInfo.fullName}</p>
                <p><strong>رقم الهاتف:</strong> ${currentResults.customerInfo.phone}</p>
                <p><strong>المنطقة:</strong> ${currentResults.customerInfo.region}</p>
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            
            <h2>تفاصيل الاستهلاك اليومي</h2>
            <table>
                <thead>
                    <tr>
                        <th>الجهاز</th>
                        <th>العدد</th>
                        <th>ساعات النهار</th>
                        <th>ساعات المساء</th>
                        <th>استهلاك النهار</th>
                        <th>استهلاك المساء</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(currentResults.deviceConsumption).map(device => `
                        <tr>
                            <td>${device.name}</td>
                            <td>${device.count}</td>
                            <td>${device.dayHours.toFixed(1)}</td>
                            <td>${device.nightHours.toFixed(1)}</td>
                            <td>${Math.round(device.dayConsumption)} واط</td>
                            <td>${Math.round(device.nightConsumption)} واط</td>
                            <td>${Math.round(device.totalConsumption)} واط</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#4caf50;color:white;font-weight:bold">
                        <td colspan="4">المجموع النهائي</td>
                        <td>${Math.round(currentResults.totalDayConsumption)} واط</td>
                        <td>${Math.round(currentResults.totalNightConsumption)} واط</td>
                        <td>${Math.round(currentResults.totalDayConsumption + currentResults.totalNightConsumption)} واط</td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- إضافة فاصل صفحة إذا كان المحتوى طويلاً -->
            <div class="page-break"></div>
            
            <h2>مكونات المنظومة المقترحة</h2>
            
            <table>
                <thead>
                    <tr>
                        <th width="33%">الألواح الشمسية</th>
                        <th width="33%">جهاز الأنفرتر</th>
                        <th width="33%">البطارية</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="vertical-align: top; text-align: right; padding: 10px;">
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>${(appSettings.panel_names && appSettings.panel_names.panel_585) || '585 واط'}:</strong> ${currentResults.panels.panels585}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>${(appSettings.panel_names && appSettings.panel_names.panel_645) || '645 واط'}:</strong> ${currentResults.panels.panels645}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>${(appSettings.panel_names && appSettings.panel_names.panel_715) || '715 واط'}:</strong> ${currentResults.panels.panels715}
                            </p>
                            <p style="margin: 5px 0; font-weight: bold;">
                                <strong>المجموع:</strong> ${currentResults.panels.total}
                            </p>
                        </td>
                        <td style="vertical-align: top; text-align: right; padding: 10px;">
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>النوع:</strong> ${currentResults.inverter.type}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>العلامة:</strong> ${currentResults.inverter.brand}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>الأحمال:</strong> ${currentResults.totalHourlyLoad} واط/ساعة
                            </p>
                            ${currentResults.inverter.details ? `
                            <p style="margin: 5px 0;">
                                <strong>التفاصيل:</strong> ${currentResults.inverter.details}
                            </p>
                            ` : ''}
                        </td>
                        <td style="vertical-align: top; text-align: right; padding: 10px;">
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>النوع:</strong> ${currentResults.battery.type}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>العدد:</strong> ${currentResults.battery.count || '-'}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>السعة:</strong> ${currentResults.battery.capacity}
                            </p>
                            <p style="margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                                <strong>الصافي:</strong> ${currentResults.battery.net || '-'}
                            </p>
                            
                            <p style="margin: 5px 0;">
                                <strong>استهلاك المساء:</strong> ${Math.round(currentResults.totalNightConsumption)} واط
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <div class="footer">
               
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();

    // إعادة حالة العرض إلى ما كانت عليه
    resultsSection.style.display = originalDisplay;
}

async function generatePDF() {
    const pdfBtn = document.getElementById('pdf-btn');
    const pdfBtnText = document.getElementById('pdf-btn-text');

    // Print Settings
    const printConfig = appSettings.printConfig || {};
    const primaryColorHex = printConfig.primaryColor || "#2e7d32";
    const textColorHex = printConfig.textColor || "#333333";
    const headerTitle = printConfig.headerTitle || "مؤسسة ديار المفلحي للطاقة الشمسية";

    const contactInfo = printConfig.contactInfo || "هاتف: 771627162 | القيم (التاريخ) - بعد محطة السالم وهدفى برزان";

    // Helper to convert hex to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 46, g: 125, b: 50 };
    }

    const primaryColor = hexToRgb(primaryColorHex);
    const textColor = hexToRgb(textColorHex);

    try {
        pdfBtn.disabled = true;


        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // إضافة الهيدر في كل صفحة
        function addHeader(pageNum, totalPages) {
            doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
            doc.rect(0, 0, pageWidth, 25, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.text(headerTitle, pageWidth / 2, 10, { align: 'center' });
            doc.setFontSize(12);
            doc.text(headerSubtitle, pageWidth / 2, 18, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`الصفحة ${pageNum} من ${totalPages}`, pageWidth - margin, pageHeight - 10);
        }

        // الصفحة 1: معلومات العميل والمقدمة
        addHeader(1, 3);

        let yPos = 35;

        // معلومات العميل
        doc.setFontSize(14);
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.text('معلومات العميل', margin, yPos);
        yPos += 10;

        doc.setFontSize(12);
        doc.setTextColor(textColor.r, textColor.g, textColor.b);

        const customerInfoData = [[
            `الاسم: ${currentResults.customerInfo.fullName}`,
            `رقم التواصل: ${currentResults.customerInfo.phone}`,
            `المنطقة: ${currentResults.customerInfo.region}`,
            `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`
        ]];

        doc.autoTable({
            startY: yPos,
            body: customerInfoData,
            theme: 'plain',
            styles: {
                font: 'Arial',
                fontSize: 10,
                halign: 'right', // Align text to right for RTL look within cells
                cellPadding: 2,
                textColor: [0, 0, 0]
            },
            bodyStyles: {
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 'auto' }
            },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // ملخص الاستهلاك
        doc.setFontSize(14);
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.text('ملخص الاستهلاك اليومي', margin, yPos);
        yPos += 10;

        doc.setFontSize(12);
        doc.setTextColor(textColor.r, textColor.g, textColor.b);
        doc.text(`إجمالي استهلاك النهار: ${Math.round(currentResults.totalDayConsumption)} واط`, margin, yPos);
        yPos += 7;
        doc.text(`إجمالي استهلاك المساء: ${Math.round(currentResults.totalNightConsumption)} واط`, margin, yPos);
        yPos += 7;
        doc.text(`الإجمالي الكلي: ${Math.round(currentResults.totalDayConsumption + currentResults.totalNightConsumption)} واط`, margin, yPos);
        yPos += 15;

        // الصفحة 2: جدول الاستهلاك التفصيلي
        doc.addPage();
        addHeader(2, 3);
        yPos = 35;

        doc.setFontSize(14);
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.text('تفاصيل الاستهلاك اليومي', margin, yPos);
        yPos += 10;

        // إنشاء جدول
        const tableHeaders = [
            'الجهاز',
            'العدد',
            'ساعات النهار',
            'ساعات المساء',
            'استهلاك النهار',
            'استهلاك المساء',
            'الإجمالي'
        ];

        const tableData = Object.values(currentResults.deviceConsumption).map(device => [
            device.name,
            device.count.toString(),
            device.dayHours.toFixed(1),
            device.nightHours.toFixed(1),
            Math.round(device.dayConsumption) + ' واط',
            Math.round(device.nightConsumption) + ' واط',
            Math.round(device.totalConsumption) + ' واط'
        ]);

        // إضافة المجموع النهائي
        tableData.push([
            'المجموع النهائي',
            '',
            '',
            '',
            Math.round(currentResults.totalDayConsumption) + ' واط',
            Math.round(currentResults.totalNightConsumption) + ' واط',
            Math.round(currentResults.totalDayConsumption + currentResults.totalNightConsumption) + ' واط'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [tableHeaders],
            body: tableData,
            margin: { left: margin, right: margin },
            theme: 'grid',
            styles: {
                font: 'Arial',
                fontSize: 10,
                halign: 'center',
                cellPadding: 4,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineColor: [0, 0, 0],
                lineWidth: 0.1
            },
            bodyStyles: {
                textColor: [0, 0, 0]
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255]
            },
            willDrawCell: function (data) {
                // تلوين صف المجموع النهائي
                if (data.row.index === tableData.length - 1) {
                    doc.setFillColor(primaryColor.r + 20, primaryColor.g + 20, primaryColor.b + 20);
                    doc.setTextColor(255, 255, 255);
                    doc.setFontStyle('bold');
                }
            },
            didParseCell: function (data) {
                if (data.row.index === tableData.length - 1) {
                    data.cell.styles.fillColor = [primaryColor.r + 20, primaryColor.g + 20, primaryColor.b + 20];
                    data.cell.styles.textColor = [255, 255, 255];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // الصفحة 3: مكونات المنظومة
        doc.addPage();
        addHeader(3, 3);
        yPos = 35;



        // مكونات المنظومة - جدول واحد مقسم إلى 3
        doc.setFontSize(14);
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.text('مكونات المنظومة المقترحة', margin, yPos);
        yPos += 5;

        // تجهيز بيانات كل عمود
        const panelsText = `${(appSettings.panel_names && appSettings.panel_names.panel_585) || '585 واط'}: ${currentResults.panels.panels585}\n` +
            `${(appSettings.panel_names && appSettings.panel_names.panel_645) || '645 واط'}: ${currentResults.panels.panels645}\n` +
            `${(appSettings.panel_names && appSettings.panel_names.panel_715) || '715 واط'}: ${currentResults.panels.panels715}\n\n` +
            `المجموع: ${currentResults.panels.total}`;

        let inverterText = `النوع: ${currentResults.inverter.type}\n` +
            `العلامة: ${currentResults.inverter.brand}\n` +
            `الأحمال: ${currentResults.totalHourlyLoad} واط/ساعة`;
        if (currentResults.inverter.details) {
            inverterText += `\nالتفاصيل: ${currentResults.inverter.details}`;
        }

        let batteryText = `النوع: ${currentResults.battery.type}\n` +
            `الصافي: ${currentResults.battery.net || '-'}\n` +
            `السعة: ${currentResults.battery.capacity}\n` +
            `العدد: ${currentResults.battery.count || '-'}\n` +
            `استهلاك المساء: ${Math.round(currentResults.totalNightConsumption)} واط`;
        if (currentResults.battery.specs) {
            batteryText += `\nالمواصفات: ${currentResults.battery.specs}`;
        }

        doc.autoTable({
            startY: yPos,
            head: [['الألواح الشمسية', 'جهاز الأنفرتر', 'البطارية']],
            body: [[panelsText, inverterText, batteryText]],
            margin: { left: margin, right: margin },
            theme: 'grid',
            styles: {
                font: 'Arial',
                fontSize: 10,
                halign: 'right', // Right indent for content
                cellPadding: 4,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0],
                valign: 'top' // Align top
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                halign: 'center' // Center headers
            },
            columnStyles: {
                0: { cellWidth: '33%' },
                1: { cellWidth: '33%' },
                2: { cellWidth: '33%' }
            }
        });

        // التذييل
        yPos = pageHeight - 15;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);

        // التذييل - هاتف وعنوان فقط
        yPos = pageHeight - 10;
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('العنوان: صنعاء - جوال: 771627162 - 770599098', pageWidth / 2, yPos, { align: 'center' });

        // حفظ الملف
        const customerName = currentResults.customerInfo.fullName.replace(/\s+/g, '_');
        doc.save(`تقرير_المنظومة_الشمسية_${customerName}.pdf`);

        pdfBtn.disabled = false;
        pdfBtnText.textContent = 'طباعة التقرير PDF';

    } catch (error) {
        console.error('خطأ في إنشاء PDF:', error);

        // بديل في حالة الخطأ
        generateSimplePDF();

        pdfBtn.disabled = false;
        pdfBtnText.textContent = 'طباعة التقرير PDF';
    }
}
// بديل مبسط يعمل دائماً
function generateSimplePDF() {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('ar-EG');

    // Print Settings
    const printConfig = appSettings.printConfig || {};
    const primaryColor = printConfig.primaryColor || "#2e7d32";
    const textColor = printConfig.textColor || "#333333";
    // Check if user set a custom title, otherwise fallback
    const headerTitle = printConfig.headerTitle || "مؤسسة ديار المفلحي للطاقة الشمسية";
    const headerSubtitle = printConfig.headerSubtitle || "تقرير المنظومة الشمسية";
    const footerText = printConfig.footerText || "مؤسسة ديار المفلحي للطاقة الشمسية";
    const contactInfo = printConfig.contactInfo || "هاتف: 771627162 | القيم (التاريخ) - بعد محطة السالم وهدفى برزان";

    printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <title>${headerSubtitle} - ${currentResults.customerInfo.fullName}</title>
                    <meta charset="UTF-8">
                    <style>
                        body { 
                            font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif; 
                            margin: 20px; 
                            line-height: 1.6;
                            color: ${textColor};
                            direction: rtl;
                        }
                        .header { 
                            text-align: center; 
                            margin-bottom: 30px;
                            border-bottom: 2px solid ${primaryColor};
                            padding-bottom: 15px;
                        }
                        .header h1 { 
                            color: ${primaryColor}; 
                            margin: 0; 
                            font-size: 24px;
                        }
                        .header h2 { 
                            color: ${primaryColor}; 
                            margin: 5px 0; 
                            font-size: 18px;
                            opacity: 0.8;
                        }
                        .customer-info { 
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            background: transparent;
                            border-bottom: 1px solid #ccc;
                            padding: 10px 0;
                            margin-bottom: 20px; 
                        }
                        .customer-info p {
                            margin: 0 10px;
                        }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-bottom: 20px; 
                            font-size: 14px;
                        }
                        th, td { 
                            border: 1px solid #000; 
                            padding: 4px; 
                            text-align: center; 
                            color: #000;
                        }
                        th { 
                            background: transparent; 
                            color: #000; 
                            font-weight: bold;
                        }
                        .total-row { 
                            background: transparent; 
                            color: #000; 
                            font-weight: bold; 
                        }
                        .components { 
                            display: grid; 
                            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
                            gap: 15px; 
                            margin-bottom: 20px; 
                        }
                        .component { 
                            border: 1px solid #ddd; 
                            padding: 15px; 
                            border-radius: 5px; 
                        }
                        .component h3 { 
                            color: ${primaryColor}; 
                            margin-top: 0; 
                            border-bottom: 1px solid #eee; 
                            padding-bottom: 10px; 
                        }
                        .footer { 
                            text-align: center; 
                            margin-top: 15px; 
                            padding-top: 5px; 
                            color: #888; 
                            font-size: 10px;
                            border-top: 1px solid #f5f5f5;
                        }

                        @media print {
                            body { margin: 0; }
                            .header { margin-bottom: 20px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${headerTitle}</h1>
                        <h2>${headerSubtitle}</h2>
                        <p>${contactInfo}</p>
                    </div>
                    
                    <h2 style="text-align: center; color: ${primaryColor};">نتائج تحليل المنظومة الشمسية</h2>
                    
                    <div class="customer-info">
                        <p><strong>الاسم:</strong> ${currentResults.customerInfo.fullName}</p>
                        <p><strong>رقم التواصل:</strong> ${currentResults.customerInfo.phone}</p>
                        <p><strong>المنطقة:</strong> ${currentResults.customerInfo.region}</p>
                        <p><strong>تاريخ الطلب:</strong> ${document.getElementById('order-date').textContent}</p>
                    </div>
                    
                    <h3>تفاصيل الاستهلاك اليومي</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>الجهاز</th>
                                <th>العدد</th>
                                <th>ساعات النهار</th>
                                <th>ساعات المساء</th>
                                <th>استهلاك النهار (واط)</th>
                                <th>استهلاك المساء (واط)</th>
                                <th>الإجمالي (واط)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.values(currentResults.deviceConsumption).map(device => `
                                <tr>
                                    <td>${device.name}</td>
                                    <td>${device.count}</td>
                                    <td>${device.dayHours.toFixed(1)}</td>
                                    <td>${device.nightHours.toFixed(1)}</td>
                                    <td>${Math.round(device.dayConsumption)}</td>
                                    <td>${Math.round(device.nightConsumption)}</td>
                                    <td>${Math.round(device.totalConsumption)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="4">المجموع النهائي</td>
                                <td>${Math.round(currentResults.totalDayConsumption)}</td>
                                <td>${Math.round(currentResults.totalNightConsumption)}</td>
                                <td>${Math.round(currentResults.totalDayConsumption + currentResults.totalNightConsumption)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <h3 style="margin-top: 20px;">مكونات المنظومة المقترحة</h3>
                    <table>
                        <thead>
                            <tr>
                                <th width="33%">الألواح الشمسية</th>
                                <th width="33%">جهاز الأنفرتر</th>
                                <th width="33%">البطارية</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="vertical-align: top; text-align: right; padding: 10px;">
                                    <p><strong>${(appSettings.panel_names && appSettings.panel_names.panel_585) || '585 واط'}:</strong> ${currentResults.panels.panels585}</p>
                                    <p><strong>${(appSettings.panel_names && appSettings.panel_names.panel_645) || '645 واط'}:</strong> ${currentResults.panels.panels645}</p>
                                    <p><strong>${(appSettings.panel_names && appSettings.panel_names.panel_715) || '715 واط'}:</strong> ${currentResults.panels.panels715}</p>
                                    
                                </td>
                                <td style="vertical-align: top; text-align: right; padding: 10px;">
                                    <p><strong>النوع:</strong> ${currentResults.inverter.type}</p>
                                    <p><strong>العلامة:</strong> ${currentResults.inverter.brand}</p>
                                    <p><strong>الأحمال:</strong> ${currentResults.totalHourlyLoad} واط/ساعة</p>
                                </td>
                                <td style="vertical-align: top; text-align: right; padding: 10px;">
                                    <p><strong>النوع:</strong> ${currentResults.battery.type}</p>
                                    <p><strong>العدد:</strong> ${currentResults.battery.count || '-'}</p>
                                    <p><strong>السعة:</strong> ${currentResults.battery.capacity}</p>
                                    <p><strong>الصافي:</strong> ${currentResults.battery.net || '-'}</p>
                                    <p><strong>استهلاك المساء:</strong> ${Math.round(currentResults.totalNightConsumption)} واط</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                       
                    </div>
                </body>
                </html>
            `);

    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// دالة حساب إجمالي الأحمال في الساعة
function calculateHourlyLoad(deviceConsumption) {
    let totalHourlyLoad = 0;

    Object.values(deviceConsumption).forEach(device => {
        // حساب الحمل الساعي لكل جهاز (عدد الأجهزة × استهلاك الجهاز)
        const deviceHourlyLoad = device.count * getDeviceWattage(device.name);
        totalHourlyLoad += deviceHourlyLoad;
    });

    return Math.round(totalHourlyLoad);
}

// دالة للحصول على استهلاك الجهاز بالواط
function getDeviceWattage(deviceName) {
    const wattageMap = {
        'لمبات': 15,
        'مراوح': 25,
        'شاشات': 100,
        'غسالات': 500,
        'ثلاجات': 140,
        'مكيف طن': 1200,
        'مكيف طن ونص': 1700
    };

    return wattageMap[deviceName] || 0;
}

// دالة للتحقق من صحة المنطقة
function validateRegion() {
    const regionSelect = document.getElementById('region');
    const regionGroup = document.getElementById('region-group');
    const regionWarning = document.getElementById('region-warning');

    if (!regionSelect.value) {
        regionGroup.classList.add('error');
        regionWarning.style.display = 'block';
        return false;
    } else {
        regionGroup.classList.remove('error');
        regionWarning.style.display = 'none';
        return true;
    }
}

// دالة للتحقق من جميع الحقول المطلوبة
function validateAllRequiredFields() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phone = document.getElementById('phone').value;

    let isValid = true;

    // التحقق من الحقول النصية
    if (!firstName) {
        markFieldAsError('firstName');
        isValid = false;
    }

    if (!lastName) {
        markFieldAsError('lastName');
        isValid = false;
    }

    if (!phone) {
        markFieldAsError('phone');
        isValid = false;
    }

    // التحقق من المنطقة
    if (!validateRegion()) {
        isValid = false;
    }

    return isValid;
}

// دالة لتحديد الحقل كخطأ
function markFieldAsError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.style.borderColor = '#d32f2f';
        field.style.boxShadow = '0 0 0 2px rgba(211, 47, 47, 0.2)';

        // إزالة نمط الخطأ عند التركيز على الحقل
        field.addEventListener('focus', function () {
            this.style.borderColor = 'var(--primary-color)';
            this.style.boxShadow = '0 0 0 2px rgba(46, 125, 50, 0.2)';
        }, { once: true });
    }
}

// البدء في تحميل البيانات عند تشغيل الصفحة
console.log("Initializing Solar App...");
loadAppSettings();