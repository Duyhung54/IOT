let chartInside, chartOutside;

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
