// ========== Firebase Integration for Dashboard ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCauUOWV67DX4pHVzJw9BHaaVqdcbe-RTs",
    authDomain: "mse-iot-smart-home.firebaseapp.com",
    databaseURL: "https://mse-iot-smart-home-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mse-iot-smart-home",
    storageBucket: "mse-iot-smart-home.firebasestorage.app",
    messagingSenderId: "333826794599",
    appId: "1:333826794599:web:1bde93ad6d6e041a57e0c2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Firebase Paths
const SENSOR_PATH = "cooling_system/sensor_data";
const sensorRef = ref(db, SENSOR_PATH);

// Keep history for charts (last 50 points)
const sensorHistory = [];
const MAX_HISTORY = 50;

// Listen to sensor data updates
onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    console.log('📡 Firebase sensor data:', data);

    // Use helper to extract values from either flat or nested structure
    const inside = (data.temp_inside !== undefined)
        ? data.temp_inside
        : (data.temperatures?.inside?.value);

    const outside = (data.temp_outside !== undefined)
        ? data.temp_outside
        : (data.temperatures?.outside?.value);

    // Update temperature displays
    updateTemperatureDisplays(inside, outside);

    // Add to history for charts
    // Helper needs timestamp too
    const timestamp = data.ts || (data.temperatures?.inside?.ts) || Math.floor(Date.now() / 1000);
    addToHistory(timestamp, inside, outside);

    // Update charts
    updateChartsFromHistory();

    // Update status indicator
    updateConnectionStatus(true, 'Connected - Data Received');
}, (error) => {
    console.error('❌ Firebase error:', error);
    updateConnectionStatus(false, 'Firebase Error: ' + error.message);
});

function updateTemperatureDisplays(inside, outside) {
    // Inside Temperature
    const tempInsideVal = document.getElementById('temp-inside-val');
    if (tempInsideVal && inside !== undefined) {
        tempInsideVal.textContent = Number(inside).toFixed(1);
    }

    // Outside Temperature
    const tempOutsideVal = document.getElementById('temp-outside-val');
    if (tempOutsideVal && outside !== undefined) {
        tempOutsideVal.textContent = Number(outside).toFixed(1);
    }

    // Weather card outside temp
    const tempOutside = document.getElementById('temp-outside');
    if (tempOutside && outside !== undefined) {
        tempOutside.textContent = Number(outside).toFixed(1);
    }
}

function addToHistory(timestamp, inside, outside) {
    sensorHistory.push({
        timestamp: timestamp,
        temp_inside: inside || 0,
        temp_outside: outside || 0
    });

    // Keep only last MAX_HISTORY points
    if (sensorHistory.length > MAX_HISTORY) {
        sensorHistory.shift();
    }
}

function updateChartsFromHistory() {
    if (sensorHistory.length === 0) return;

    // Prepare data for charts with labels
    // Create simple labels like "1", "2", "3" or empty strings
    const labels = sensorHistory.map((_, i) => i);
    const insideData = sensorHistory.map(d => d.temp_inside);
    const outsideData = sensorHistory.map(d => d.temp_outside);

    // Call global updateCharts function from dashboard.js
    if (typeof window.updateCharts === 'function') {
        window.updateCharts(labels, insideData, outsideData);
    } else {
        console.warn('window.updateCharts is not defined yet');
    }
}

function updateConnectionStatus(connected, msg) {
    const statusIndicator = document.querySelector('.status-indicator');
    const dateDisplay = document.getElementById('current-date');

    if (statusIndicator) {
        if (connected) {
            statusIndicator.classList.add('online');
            statusIndicator.classList.remove('offline');
        } else {
            statusIndicator.classList.remove('online');
            statusIndicator.classList.add('offline');
        }
    }

    if (dateDisplay && msg) {
        dateDisplay.textContent = msg;
        setTimeout(() => {
            const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
            dateDisplay.textContent = new Date().toLocaleDateString('en-US', dateOptions);
        }, 5000);
    }
}

// Export for use in dashboard.js
window.firebaseIntegration = {
    sensorHistory,
    updateChartsFromHistory
};

console.log('🔥 Firebase integration loaded');
