//we have set the timeline range from 2019 to february 2024, the last full month that has passed at the time of project submission (march 15th, 2024) 
function checkDate(dateString){
    var dateParts = dateString.split("-");
    var inputDate = new Date(parseInt(dateParts[2], 10), parseInt(dateParts[1], 10)-1, parseInt(dateParts[0], 10));
    const minDate = new Date(2012,1,1); //01/01/2012
    const maxDate = new Date(2024,2,29); //02/29/2024
    return inputDate >= minDate && inputDate <= maxDate;
};

// mapping month values into month text for easier viewing
const monthMap = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};

//each artist can have hundreds of setlists, but each API call only returns one page consisting of 20 setlists
//to determine how many pages to make API calls for, an initial API call is needed to retrive the total setlist count
async function getTotalSetlists(artistName){
    var page = 1;
    try{
        const response = await axios.get(`http://localhost:3000/api/data/concerts/${artistName}/${page}`);
        if(response.status != 200){
            throw new Error('Network response was not ok');
        }
        return response.data.total;
    }catch(error){
        console.error('Error getting total setlists:', error);
        return 0;
    }
}

//handles getting all the setlists for a specific page query - can return from 1-20 setlists
async function getSetlistPage(artistName, page){
    try{
        const response = await axios.get(`http://localhost:3000/api/data/concerts/${artistName}/${page}`);
        if(response.status != 200){
            throw new Error('Network response was not ok');
        }
        return response.data.setlist;
    }catch(error){
        console.error('Error getting a setlist page:', error);
        return 0;
    }
}

//parses through setlists, specifically retaining setlists that fall within our date range using checkDate() helper function
//formats valid setlists into CSV string
async function extractSetlistData(setlist, setlistArray){
    if(checkDate(setlist.eventDate)){
        var dateSplit = setlist.eventDate.split("-");
        var formattedDate = monthMap[parseInt((dateSplit[1], 10)-1)] + " " +  parseInt(dateSplit[2], 10);
        setlistArray.push(formattedDate + "," + setlist.artist.name + "," + setlist.venue.city.coords.lat + "," + setlist.venue.city.coords.long);
    }
}

//main code, triggers when html loads
document.addEventListener('DOMContentLoaded', async() => {
    //our team received feedback from the professor during office hours that our storyline would be even more compelling if we followed the specific journey of different K-Pop groups
    //so, our team selected 14 KPOP groups, ranging from 2nd to 4th generation groups, meaning they debuted (released to public) from 2000-2023
    //we specifically selected the industry leading groups from each generation, with a mix of male and female groups to provide a more well-balanced story of K-Pop over time
    //we chose to not select groups who debuted from 2023 onward, which are relatively new and don't provide significant insight into the growth of K-Pop over time
    const artists = ["BTS", "BLACKPINK", "PSY", "EXO", "DAY6", "Girls' Generation", "BigBang", "MAMAMOO", "MOMOLAND", "GOT7", "Stray Kids", "TOMORROW X TOGETHER", "ITZY", "ENHYPEN"];
    let concertsArray = ["Date,Artist,Latitude,Longitude"]; //header for CSV file
    
    for (i in artists){
        const totalSetlists = await getTotalSetlists(artists[i])
        const totalPages = Math.ceil(totalSetlists/20); //20 setlists per page
        
        for(let page=1;page <= totalPages;page++){
            const setlists = await getSetlistPage(artists[i], page);
            for(const setlist of setlists){
                await extractSetlistData(setlist, concertsArray);
            }
        }
    }
    console.log(concertsArray); //holds all the parsed CSV data containing formatted date and coordinate information that needs to be written into a file
    
    // populates CSV file containing dataset, and automatically downloads it from browser
    // this method was used because the  
    const concertsFormatted = concertsArray.join('\n');
    const blob = new Blob([concertsFormatted], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = 'concerts.csv';
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}); 

