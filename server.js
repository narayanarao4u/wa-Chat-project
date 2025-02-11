const express = require('express');
// ...existing code...

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// ...existing code...

// Replace the /reports route with this
app.get('/reports', async (req, res) => {
    try {
        const stats = await dbOps.getFeedbackStats();
        res.render('reports', { stats: JSON.stringify(stats) });
    } catch (error) {
        console.error('Error rendering reports:', error);
        res.status(500).send('Error generating reports');
    }
});

// ...existing code...
