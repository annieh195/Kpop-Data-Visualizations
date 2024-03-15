const express = require('express');
const axios = require('axios');
const csv = require('csv-writer').createObjectCsvWriter;
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5501;

app.use(cors());

app.get('/search', (req, res) => {
    res.send('CSV file generation triggered');
});

async function generateCSV() {
    const keywords = ["kpop", "BTS", "BLACKPINK", "PSY", "EXO", "DAY6", "Girls’ Generation", "BIGBANG", "MAMAMOO", "GOT7", "Stray Kids", "TXT", "ITZY", "ENHYPEN", "G-IDLE", "The Beatles"];

    // Write data to CSV
    const csvWriter = csv({
        path: `chart_data.csv`,
        header: [
            { id: 'date', title: 'Date' },
            ...keywords.map(keyword => ({ id: keyword, title: keyword }))
        ]
    });

    const records = {};

    for (const keyword of keywords) {
        console.log(`Generating CSV file for ${keyword}...`);
        const apiKey = process.env.SERPAPI_KEY;
        try {
            const response = await axios.get('https://serpapi.com/search', {
                params: {
                    engine: 'google_trends',
                    q: keyword,
                    geo: "US",
                    date: '2012-01-01 2024-02-01',
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
                records[date][keyword] = data.values[0].value;
            });

            console.log(`CSV data fetched successfully for ${keyword}`);
        } catch (error) {
            console.error(`Error calling SerpAPI for ${keyword}:`, error);
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