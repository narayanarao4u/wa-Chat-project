document.addEventListener('DOMContentLoaded', function() {
    if (!statsData) {
        console.error('No stats data available');
        document.getElementById('totalFeedbacks').textContent = 'No data';
        document.getElementById('uniqueCustomers').textContent = 'No data';
        return;
    }

    // Update statistics
    document.getElementById('totalFeedbacks').textContent = statsData.customerStats.total_feedbacks;
    document.getElementById('uniqueCustomers').textContent = statsData.customerStats.unique_customers;

    // Initialize trend chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: statsData.daily.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [{
                label: 'Daily Feedbacks',
                data: statsData.daily.map(d => d.count),
                borderColor: '#0047ab',
                backgroundColor: 'rgba(0, 71, 171, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Initialize distribution chart
    const distCtx = document.getElementById('distributionChart').getContext('2d');
    new Chart(distCtx, {
        type: 'doughnut',
        data: {
            labels: statsData.distribution.map(d => d.feedback),
            datasets: [{
                data: statsData.distribution.map(d => d.count),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
});
