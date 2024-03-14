const express = require('express');
const axios = require('axios');
const csv = require('csv-writer').createObjectCsvWriter;
const cors = require('cors');
const app = express();
require('dotenv').config();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/search', (req, res) => {
    res.send('CSV file generation triggered');
});

async function generateCSV() {
    const stateCodes = [
        'US-GA', 'US-MD', 'US-AL', 'US-AK', 'US-AZ', 'US-AR',
        'US-CA', 'US-CO', 'US-CT', 'US-DE', 'US-DC', 'US-FL',
        'US-HI', 'US-ID', 'US-IL', 'US-IN', 'US-IA', 'US-KS',
        'US-KY', 'US-LA', 'US-ME', 'US-MA', 'US-MI', 'US-MN',
        'US-MS', 'US-MO', 'US-MT', 'US-NE', 'US-NV', 'US-NH',
        'US-NJ', 'US-NM', 'US-NY', 'US-NC', 'US-ND', 'US-OH',
        'US-OK', 'US-OR', 'US-PA', 'US-RI', 'US-SC', 'US-SD',
        'US-TN', 'US-TX', 'US-UT', 'US-VT', 'US-VA', 'US-WA',
        'US-WV', 'US-WI', 'US-WY'
    ];

    // Write data to CSV
    const csvWriter = csv({
        path: `interest_over_time.csv`,
        header: [
            { id: 'date', title: 'Date' },
            ...stateCodes.map(stateCode => ({ id: stateCode, title: stateCode }))
        ]
    });

    const records = {};

    for (const stateCode of stateCodes) {
        console.log(`Generating CSV file for ${stateCode}...`);
        const apiKey = process.env.SERP_API_KEY;
        try {
            const response = await axios.get('https://serpapi.com/search', {
                params: {
                    engine: 'google_trends',
                    q: 'kpop',
                    geo: stateCode,
                    date: '2012-01-01 2024-03-01',
                    tz: "420",
                    data_type: "TIMESERIES",
                    api_key: apiKey
                }
            });

            // Extract timeline_data from the response
            const timelineData = response.data.interest_over_time.timeline_data;

            // Update records with data for each date
            timelineData.forEach(data => {
                const date = data.date;
                if (!records[date]) {
                    records[date] = { date };
                }
                records[date][stateCode] = data.values[0].value;
            });

            console.log(`CSV data fetched successfully for ${stateCode}`);
        } catch (error) {
            console.error(`Error calling SerpAPI for ${stateCode}:`, error);
        }
    }

    // Write records to CSV
    await csvWriter.writeRecords(Object.values(records));
    console.log('CSV file generated successfully');
}


app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    await generateCSV();
});