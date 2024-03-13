const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ^^ Import necessary libraries to setup an express server to run API calls

app.get('/api/data/concerts/:artistName/:page', async(req,res) =>{
    const artistName = req.params.artistName;
    const page = req.params.page;
    try{
        const response = await axios.get(`https://api.setlist.fm/rest/1.0/search/setlists?artistName=${artistName}&countryCode=US&p=${page}&sort=sortName`, {
            headers: {
                'x-api-key': process.env.SETLISTFM_API_KEY // For security, the API key is in an .env file
            }
        });
        const data = response.data;
        res.json(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});