// ========== Chart Variables ==========
let chartInside, chartOutside;

// ========== Data Fetching ==========


function updateCharts(labels, insideData, outsideData) {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
            x: { display: false },
            y: { display: false }
        },
        elements: {
            line: { tension: 0.4, borderWidth: 2 },
            point: { radius: 0 }
        }
    };

    const ctxIn = document.getElementById('chartInside');
    const ctxOut = document.getElementById('chartOutside');

    if (!ctxIn || !ctxOut) return;

    // Inside Temperature Chart
    if (chartInside) {
        chartInside.data.labels = labels;
        chartInside.data.datasets[0].data = insideData;
        chartInside.update('none');
    } else {
        chartInside = new Chart(ctxIn, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: insideData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true
                }]
            },
            options: commonOptions
        });
    }

    // Outside Temperature Chart
    if (chartOutside) {
        chartOutside.data.labels = labels;
        chartOutside.data.datasets[0].data = outsideData;
        chartOutside.update('none');
    } else {
        chartOutside = new Chart(ctxOut, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: outsideData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }]
            },
            options: commonOptions
        });
    }
}

// Ensure chart function is accessible by firebase-integration.js
window.updateCharts = updateCharts;



// ========== Weather Functions ==========
async function fetchWeather() {
    try {
        const response = await fetch('/api/weather/current');
        const data = await response.json();

        const tempEl = document.getElementById('temp-outside');
        if (tempEl) tempEl.textContent = data.temperature;

        const descEl = document.querySelector('.weather-text h3');
        if (descEl) descEl.textContent = data.description;

        const locEl = document.querySelector('.weather-text p');
        if (locEl) locEl.textContent = data.location;

        const iconEl = document.querySelector('.weather-icon');
        if (iconEl) {
            const iconMap = {
                '01d': 'wb_sunny',
                '01n': 'nights_stay',
                '02d': 'wb_cloudy',
                '02n': 'wb_cloudy',
                '03d': 'cloud',
                '03n': 'cloud',
                '04d': 'cloud',
                '04n': 'cloud',
                '09d': 'grain',
                '09n': 'grain',
                '10d': 'wb_cloudy',
                '10n': 'wb_cloudy',
                '11d': 'flash_on',
                '11n': 'flash_on',
                '13d': 'ac_unit',
                '13n': 'ac_unit',
                '50d': 'blur_on',
                '50n': 'blur_on'
            };
            iconEl.textContent = iconMap[data.icon] || 'wb_sunny';
        }
    } catch (error) {
        console.error('Error fetching weather:', error);
    }
}

async function fetchForecast() {
    try {
        const response = await fetch('/api/weather/forecast');
        const data = await response.json();

        const forecastRow = document.querySelector('.forecast-row');
        if (!forecastRow || !data.forecast) return;

        forecastRow.innerHTML = '';

        data.forecast.forEach(day => {
            const item = document.createElement('div');
            item.className = 'forecast-item';
            item.innerHTML = `
                <span>${day.day}</span>
                <span class="material-icons-round">${day.icon || 'wb_sunny'}</span>
                <span>${day.temp}°</span>
            `;
            forecastRow.appendChild(item);
        });
    } catch (error) {
        console.error('Error fetching forecast:', error);
    }
}

// Fetch weather every 30 minutes
setInterval(fetchWeather, 30 * 60 * 1000);
setInterval(fetchForecast, 30 * 60 * 1000);
fetchWeather();
fetchForecast();

// ========== DateTime Functions ==========
async function fetchDateTime() {
    try {
        const response = await fetch('/api/datetime');
        const data = await response.json();

        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const date = new Date(data.timestamp * 1000);
            const options = { weekday: 'long', month: 'short', day: 'numeric' };
            dateEl.textContent = date.toLocaleDateString('en-US', options);
        }
    } catch (error) {
        console.error('Error fetching datetime:', error);
    }
}

fetchDateTime();
setInterval(fetchDateTime, 60 * 1000);

// ========== Actuator Control Functions ==========
const setStatus = (msg) => {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = msg || '';
};

const renderRaw = (obj) => {
    const rawEl = document.getElementById('raw');
    if (rawEl) rawEl.textContent = JSON.stringify(obj, null, 2);
};

// Helper: Adjust temperature threshold (called by +/- buttons)
window.stepValue = (amount) => {
    const input = document.getElementById('temp_threshold');
    if (!input) return;
    let val = parseFloat(input.value) || 25.0;
    val = Math.round((val + amount) * 10) / 10; // Avoid float precision errors
    input.value = val;
};

const populateActuatorForm = (state) => {
    if (!state || typeof state !== 'object') return;

    // Mode (Radio Buttons)
    if (state.mode_request) {
        const radio = document.querySelector(`input[name="mode"][value="${state.mode_request}"]`);
        if (radio) radio.checked = true;
    }

    // AC & Fan (Toggles)
    const acToggle = document.getElementById('ac-toggle');
    const fanToggle = document.getElementById('fan-toggle');

    if (acToggle) acToggle.checked = (state.ac === 1);
    if (fanToggle) fanToggle.checked = (state.fan === 1);

    // Threshold & AI
    const tempEl = document.getElementById('temp_threshold');
    const aiEl = document.getElementById('end_user_ai_instruction');

    if (tempEl && state.temp_threshold !== undefined) tempEl.value = String(state.temp_threshold);
    if (aiEl && state.end_user_ai_instruction !== undefined) aiEl.value = String(state.end_user_ai_instruction);

    // Update toggle states based on mode (will be defined later)
    if (typeof updateToggleStates === 'function') {
        updateToggleStates();
    }
};

// Remote API URL
const ACTUATOR_API_URL = "https://hung25msa33055.pythonanywhere.com/iot/api/actuator/state";

async function fetchActuatorState() {
    setStatus('Fetching...');
    try {
        const res = await fetch(ACTUATOR_API_URL, { method: 'GET' });
        const data = await res.json();
        renderRaw(data);
        populateActuatorForm(data);
        setStatus(`✓ Loaded`);
    } catch (err) {
        setStatus('❌ GET failed');
        renderRaw({ error: String(err) });
    }
}

async function saveActuatorState() {
    // Mode
    const selectedMode = document.querySelector('input[name="mode"]:checked');
    const modeValue = selectedMode ? selectedMode.value : 'manual';

    // Toggles
    const acToggle = document.getElementById('ac-toggle');
    const fanToggle = document.getElementById('fan-toggle');
    const acValue = (acToggle && acToggle.checked) ? 1 : 0;
    const fanValue = (fanToggle && fanToggle.checked) ? 1 : 0;

    // Inputs
    const tempEl = document.getElementById('temp_threshold');
    const aiEl = document.getElementById('end_user_ai_instruction');

    if (!tempEl || !aiEl) {
        setStatus('❌ Form elements not found');
        return;
    }

    const payload = {
        mode_request: modeValue,
        ac: acValue,
        fan: fanValue,
        temp_threshold: Number(tempEl.value),
        end_user_ai_instruction: aiEl.value || '',
        source: 'web_client'
    };

    setStatus('Saving...');
    try {
        const res = await fetch(ACTUATOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        // Show the inner state content so it matches the GET structure
        if (data && data.api_state) {
            renderRaw(data.api_state);
            populateActuatorForm(data.api_state);
        } else {
            renderRaw(data); // Fallback
        }

        setStatus(`✓ Saved (${res.status})`);
    } catch (err) {
        setStatus('❌ POST failed');
        renderRaw({ error: String(err) });
    }
}

// ========== Mode-based Toggle Control ==========
// Function to update toggle states based on selected mode
const updateToggleStates = () => {
    const selectedMode = document.querySelector('input[name="mode"]:checked');
    const modeValue = selectedMode ? selectedMode.value : 'manual';

    const acToggle = document.getElementById('ac-toggle');
    const fanToggle = document.getElementById('fan-toggle');
    const tempThreshold = document.getElementById('temp_threshold');
    const aiTextarea = document.getElementById('end_user_ai_instruction');

    // Get parent containers for better visual control
    const acSwitch = acToggle ? acToggle.closest('.switch-container') : null;
    const fanSwitch = fanToggle ? fanToggle.closest('.switch-container') : null;
    const thresholdContainer = tempThreshold ? tempThreshold.closest('.switch-container') : null;
    const aiContainer = aiTextarea ? aiTextarea.closest('.ai-input-container') : null;

    // Handle different modes
    if (modeValue === 'auto') {
        // AUTO MODE: Disable AC & Fan, keep Threshold & AI active
        // Increase disable opacity for stronger visual feedback
        if (acToggle) acToggle.disabled = true;
        if (acSwitch) {
            acSwitch.style.opacity = '0.3';
            acSwitch.style.pointerEvents = 'none';
        }

        if (fanToggle) fanToggle.disabled = true;
        if (fanSwitch) {
            fanSwitch.style.opacity = '0.3';
            fanSwitch.style.pointerEvents = 'none';
        }

        // Keep threshold active
        if (tempThreshold) tempThreshold.disabled = false;
        if (thresholdContainer) {
            thresholdContainer.style.opacity = '1';
            thresholdContainer.style.pointerEvents = 'auto';
        }

        // Keep AI input active
        if (aiTextarea) aiTextarea.disabled = false;
        if (aiContainer) {
            aiContainer.style.opacity = '1';
            aiContainer.style.pointerEvents = 'auto';
        }

    } else if (modeValue === 'ai') {
        // AI PILOT MODE: Disable AC, Fan & Threshold, keep only AI textarea active
        if (acToggle) acToggle.disabled = true;
        if (acSwitch) {
            acSwitch.style.opacity = '0.3';
            acSwitch.style.pointerEvents = 'none';
        }

        if (fanToggle) fanToggle.disabled = true;
        if (fanSwitch) {
            fanSwitch.style.opacity = '0.3';
            fanSwitch.style.pointerEvents = 'none';
        }

        // Disable threshold in AI mode
        if (tempThreshold) tempThreshold.disabled = true;
        if (thresholdContainer) {
            thresholdContainer.style.opacity = '0.3';
            thresholdContainer.style.pointerEvents = 'none';
        }

        // ONLY AI input is active
        if (aiTextarea) aiTextarea.disabled = false;
        if (aiContainer) {
            aiContainer.style.opacity = '1';
            aiContainer.style.pointerEvents = 'auto';
        }

    } else {
        // MANUAL MODE: Enable all controls
        if (acToggle) acToggle.disabled = false;
        if (acSwitch) {
            acSwitch.style.opacity = '1';
            acSwitch.style.pointerEvents = 'auto';
        }

        if (fanToggle) fanToggle.disabled = false;
        if (fanSwitch) {
            fanSwitch.style.opacity = '1';
            fanSwitch.style.pointerEvents = 'auto';
        }

        if (tempThreshold) tempThreshold.disabled = false;
        if (thresholdContainer) {
            thresholdContainer.style.opacity = '1';
            thresholdContainer.style.pointerEvents = 'auto';
        }

        if (aiTextarea) aiTextarea.disabled = false;
        if (aiContainer) {
            aiContainer.style.opacity = '1';
            aiContainer.style.pointerEvents = 'auto';
        }
    }
};

// Add event listeners to mode radio buttons
const modeRadios = document.querySelectorAll('input[name="mode"]');
modeRadios.forEach(radio => {
    radio.addEventListener('change', updateToggleStates);
});

// Event listeners for actuator controls
const btnRefresh = document.getElementById('btn-refresh');
const btnSave = document.getElementById('btn-save');

if (btnRefresh) {
    btnRefresh.addEventListener('click', fetchActuatorState);
}

if (btnSave) {
    btnSave.addEventListener('click', saveActuatorState);
}

const btnSaveAi = document.getElementById('btn-save-ai');
if (btnSaveAi) {
    btnSaveAi.addEventListener('click', saveActuatorState);
}

// Load actuator state on page load
fetchActuatorState();

// Initialize toggle states based on current mode
updateToggleStates();

// Auto-refresh actuator state every 30 seconds
setInterval(fetchActuatorState, 30 * 1000);
