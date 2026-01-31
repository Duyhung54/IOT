let chartInside, chartOutside;
const DIAL_CONFIG = {
    minTemp: 16,
    maxTemp: 30,
    minAngle: -135,
    maxAngle: 135,
    maxDash: 350
};

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        const sortedData = data.reverse();
        updateDashboard(sortedData);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function updateDashboard(data) {
    if (data.length === 0) return;

    const latest = data[data.length - 1];

    // Update Values
    // Convert Celsius to F for "Room Temp" demo if needed, or just keep C. Let's stick to C for consistency with input, or display value.
    // The reference image showed 22.2 C, so we'll use C.
    document.getElementById('main-temp').textContent = latest.temp_inside.toFixed(1);

    document.getElementById('temp-outside').textContent = latest.temp_outside.toFixed(1);
    document.getElementById('temp-outside-val').textContent = latest.temp_outside.toFixed(1);

    document.getElementById('temp-inside-val').textContent = latest.temp_inside.toFixed(1);

    // Update Date
    const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Prepare Chart Data
    const labels = data.map(d => ''); // No labels for sparklines
    const insideData = data.map(d => d.temp_inside);
    const outsideData = data.map(d => d.temp_outside);

    updateCharts(labels, insideData, outsideData);

    // Update AC Operational Status
    updateACStatusIndicator(latest.temp_inside);
}

// Check and update AC running status
function updateACStatusIndicator(currentTemp) {
    const manualToggle = document.getElementById('manual-power-toggle');
    const autoToggle = document.getElementById('auto-enable-toggle');
    const autoThresholdSlider = document.getElementById('auto-temp-slider');
    const indicator = document.getElementById('ac-running-indicator');

    if (!manualToggle || !autoToggle || !indicator) return;

    let isRunning = false;
    const manualOn = manualToggle.checked;
    const autoEnabled = autoToggle.checked;
    const threshold = parseFloat(autoThresholdSlider.value);

    // Logic: 
    // If Manual is ON -> Running (overrides auto)
    // OR If Auto is Enabled AND Current Temp > Threshold -> Running

    // Note: In a real system, we might prioritize modes. 
    // Here assuming: If Manual is ON, it's running. 
    // If Manual is OFF, check Auto.

    if (manualOn) {
        isRunning = true;
    } else if (autoEnabled && currentTemp > threshold) {
        isRunning = true;
    }


    const acPowerBtn = document.querySelector('.ac-card .power-btn');

    if (isRunning) {
        indicator.classList.add('active');
        if (acPowerBtn) acPowerBtn.classList.add('active');
    } else {
        indicator.classList.remove('active');
        if (acPowerBtn) acPowerBtn.classList.remove('active');
    }
}

function updateCharts(labels, insideData, outsideData) {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
            x: { display: false },
            y: { display: false, min: 15, max: 35 } // Fixed scale for better visual comparison
        },
        elements: {
            point: { radius: 0 },
            line: { tension: 0.4, borderWidth: 2 }
        }
    };

    // Chart Inside
    const ctxIn = document.getElementById('chartInside').getContext('2d');
    if (chartInside) {
        chartInside.data.datasets[0].data = insideData;
        chartInside.update();
    } else {
        chartInside = new Chart(ctxIn, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: insideData,
                    borderColor: '#f97316', // Orange
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    fill: true
                }]
            },
            options: commonOptions
        });
    }

    // Chart Outside
    const ctxOut = document.getElementById('chartOutside').getContext('2d');
    if (chartOutside) {
        chartOutside.data.datasets[0].data = outsideData;
        chartOutside.update();
    } else {
        chartOutside = new Chart(ctxOut, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: outsideData,
                    borderColor: '#fbbf24', // Amber/Yellow
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: true
                }]
            },
            options: commonOptions
        });
    }
}

// Start polling
setInterval(fetchData, 5000); // Poll every 5 seconds
fetchData(); // Initial fetch



// Synchronize AC Dial visualization with temperature
function updateACDisplay(temp) {
    temp = Math.max(DIAL_CONFIG.minTemp, Math.min(DIAL_CONFIG.maxTemp, temp));

    // Update Text
    const displayEl = document.getElementById('ac-target-temp');
    if (displayEl) {
        displayEl.innerHTML = `${Math.floor(temp)}<small>.${(temp % 1).toFixed(1).substring(2)}</small>`;
    }

    // Update Dial
    const percent = (temp - DIAL_CONFIG.minTemp) / (DIAL_CONFIG.maxTemp - DIAL_CONFIG.minTemp);
    const offset = DIAL_CONFIG.maxDash * (1 - percent);
    const progressPath = document.querySelector('.dial-progress');
    if (progressPath) progressPath.style.strokeDashoffset = offset;

    const rotation = DIAL_CONFIG.minAngle + (percent * (DIAL_CONFIG.maxAngle - DIAL_CONFIG.minAngle));
    const knob = document.querySelector('.dial-knob');
    if (knob) knob.style.transform = `rotate(${rotation}deg) translate(80px) rotate(${-rotation}deg)`;
}

// Synchronize AC Mode Buttons
function updateACMode(mode) {
    // Mapping: mode -> icon name
    const iconMap = {
        'cool': 'ac_unit',
        'heat': 'wb_sunny',
        'fan': 'air'
    };

    const targetIcon = iconMap[mode];
    if (!targetIcon) return;

    // Remove active from all mode buttons (not power)
    const modeBtns = document.querySelectorAll('.ac-bottom-bar .mode-btn:not(.power-btn)');
    modeBtns.forEach(btn => {
        btn.classList.remove('active', 'active-cool', 'active-heat', 'active-fan');
        // Check if this button has the target icon
        const iconInfo = btn.querySelector('.material-icons-round');
        if (iconInfo && iconInfo.textContent === targetIcon) {
            btn.classList.add(`active-${mode}`);
        }
    });
}

// ========== AC Control Functions ==========
let currentManualMode = 'cool';

// Load AC settings on page load
async function loadACSettings() {
    try {
        const response = await fetch('/api/ac/settings');
        const settings = await response.json();

        // Update Manual Control UI
        document.getElementById('manual-power-toggle').checked = settings.is_on;
        document.getElementById('manual-temp-slider').value = settings.target_temp;
        document.getElementById('manual-temp-display').textContent = settings.target_temp.toFixed(1);

        // Update Mode Selection
        currentManualMode = settings.mode;
        updateModeButtons(settings.mode);
        updateACMode(settings.mode); // Sync AC card

        // Update Automation UI
        document.getElementById('auto-enable-toggle').checked = settings.automation_enabled;
        document.getElementById('auto-temp-slider').value = settings.threshold_temp;
        // Fix: Use correct ID for display and update input
        document.getElementById('auto-temp-display').textContent = settings.threshold_temp.toFixed(1);
        document.getElementById('auto-temp-input').value = settings.threshold_temp.toFixed(1);

        // Update automation status badge
        updateAutomationStatus(settings.automation_enabled);

        // Initial AC Status Check
        updateACStatusIndicator(currentTemp);
    } catch (error) {
        console.error('Error loading AC settings:', error);
    }
}

// Update automation status badge
function updateAutomationStatus(enabled) {
    const badge = document.getElementById('auto-status-badge');
    const statusText = document.getElementById('auto-status-text');

    if (enabled) {
        badge.classList.add('active');
        statusText.textContent = 'Active';
    } else {
        badge.classList.remove('active');
        statusText.textContent = 'Inactive';
    }
}

// Manual Control - Power Toggle
document.getElementById('manual-power-toggle').addEventListener('change', async (e) => {
    const isOn = e.target.checked;
    const targetTemp = parseFloat(document.getElementById('manual-temp-slider').value);

    // Update status immediately for responsive UI
    const currentTemp = parseFloat(document.getElementById('main-temp').textContent) || 0;
    updateACStatusIndicator(currentTemp);

    try {
        const response = await fetch('/api/ac/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_on: isOn,
                target_temp: targetTemp,
                mode: currentManualMode
            })
        });

        const result = await response.json();
        console.log('Manual control updated:', result);
    } catch (error) {
        console.error('Error setting manual control:', error);
    }
});

// Manual Control - Temperature Slider
document.getElementById('manual-temp-slider').addEventListener('input', (e) => {
    const temp = parseFloat(e.target.value);
    document.getElementById('manual-temp-display').textContent = temp.toFixed(1);
    updateACDisplay(temp);
});

document.getElementById('manual-temp-slider').addEventListener('change', async (e) => {
    const targetTemp = parseFloat(e.target.value);
    const isOn = document.getElementById('manual-power-toggle').checked;

    try {
        const response = await fetch('/api/ac/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_on: isOn,
                target_temp: targetTemp,
                mode: currentManualMode
            })
        });

        const result = await response.json();
        console.log('Temperature updated:', result);
    } catch (error) {
        console.error('Error updating temperature:', error);
    }
});

// Helper to update mode button styles
function updateModeButtons(activeMode) {
    document.querySelectorAll('.mode-select-btn').forEach(btn => {
        // Remove all active classes
        btn.classList.remove('active', 'active-cool', 'active-heat', 'active-fan');

        if (btn.dataset.mode === activeMode) {
            // Add specific active class based on mode
            btn.classList.add(`active-${activeMode}`);
        }
    });
}

// Manual Control - Mode Selection
document.querySelectorAll('.mode-select-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const mode = e.currentTarget.dataset.mode;
        currentManualMode = mode;

        // Update UI with new visual effects
        updateModeButtons(mode);
        updateACMode(mode); // Sync AC card

        // Send to backend
        const isOn = document.getElementById('manual-power-toggle').checked;
        const targetTemp = parseFloat(document.getElementById('manual-temp-slider').value);

        try {
            const response = await fetch('/api/ac/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_on: isOn,
                    target_temp: targetTemp,
                    mode: mode
                })
            });

            const result = await response.json();
            console.log('Mode updated:', result);
        } catch (error) {
            console.error('Error updating mode:', error);
        }
    });
});

// Automation - Enable Toggle
document.getElementById('auto-enable-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    const thresholdTemp = parseFloat(document.getElementById('auto-temp-slider').value);

    // Update status immediately
    const currentTemp = parseFloat(document.getElementById('main-temp').textContent) || 0;
    updateACStatusIndicator(currentTemp);

    try {
        const response = await fetch('/api/ac/automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: enabled,
                threshold_temp: thresholdTemp
            })
        });

        const result = await response.json();
        console.log('Automation updated:', result);

        // Update status badge
        updateAutomationStatus(enabled);
    } catch (error) {
        console.error('Error setting automation:', error);
    }
});

// Helper function to update threshold
async function setThreshold(value) {
    console.log('Setting threshold to:', value);
    // Clamp value between min and max
    value = Math.max(20, Math.min(32, parseFloat(value)));

    // Update all UI elements
    const input = document.getElementById('auto-temp-input');
    if (input) input.value = value.toFixed(1);

    const display = document.getElementById('auto-temp-display');
    if (display) display.textContent = value.toFixed(1);

    const slider = document.getElementById('auto-temp-slider');
    if (slider) slider.value = value;

    // Send to backend
    const toggle = document.getElementById('auto-enable-toggle');
    const enabled = toggle ? toggle.checked : false;

    try {
        const response = await fetch('/api/ac/automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: enabled,
                threshold_temp: value
            })
        });

        const result = await response.json();
        console.log('Threshold updated:', result);
    } catch (error) {
        console.error('Error updating threshold:', error);
    }
}

// Automation - Threshold Slider
document.getElementById('auto-temp-slider').addEventListener('input', (e) => {
    const temp = parseFloat(e.target.value);
    document.getElementById('auto-temp-display').textContent = temp.toFixed(1);
    document.getElementById('auto-temp-input').value = temp.toFixed(1);
});

document.getElementById('auto-temp-slider').addEventListener('change', (e) => {
    setThreshold(e.target.value);
});

// Threshold Numeric Input
document.getElementById('auto-temp-input').addEventListener('change', (e) => {
    setThreshold(e.target.value);
});

// Threshold Decrease Button
document.getElementById('auto-temp-decrease').addEventListener('click', (e) => {
    console.log('Decrease button clicked');
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling just in case
    const input = document.getElementById('auto-temp-input');
    let value = parseFloat(input.value);
    if (isNaN(value)) value = 25.0; // Fallback
    setThreshold(value - 0.5);
});

// Threshold Increase Button
document.getElementById('auto-temp-increase').addEventListener('click', (e) => {
    console.log('Increase button clicked');
    e.preventDefault();
    e.stopPropagation();
    const input = document.getElementById('auto-temp-input');
    let value = parseFloat(input.value);
    if (isNaN(value)) value = 25.0; // Fallback
    setThreshold(value + 0.5);
});

// Load AC settings when page loads
loadACSettings();
