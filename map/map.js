Promise.all([
    d3.json('us_states.topojson'),
    d3.json('us.json'),
    d3.csv('interest_over_time.csv'),
    d3.csv('concerts.csv')
]).then(function ([us, data, interestData, concertData]) {
    var states = topojson.feature(us, us.objects.us_states).features;

    var width = window.innerWidth*0.85,
        height = window.innerHeight*0.85;

    var mapMargin = { top: 0, left: 0, right: 0, bottom: 0 },
        mapWidth = width - mapMargin.left - mapMargin.right,
        mapHeight = height - mapMargin.top - mapMargin.bottom;

    // Define color scale for legend at discrete points
    const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const colors = d3.quantize(d3.interpolateGreys, 12);
    const color = d3.scaleThreshold()
        .domain(ticks)
        .range(colors);

    var svg = d3.select("#map")
        .append("svg")
        .attr("width", mapWidth + mapMargin.left + mapMargin.right)
        .attr("height", mapHeight + mapMargin.top + mapMargin.bottom);

    // Define projection and path generator
    var projection = d3.geoAlbersUsa()
        .translate([mapWidth / 2.5, mapHeight / 2])
        .scale(1000);
    var path = d3.geoPath().projection(projection);

    // CSV with states and interest values by months
    var interestDataByMonth = {};
    interestData.forEach(function (d) {
        var month = d.Date;
        interestDataByMonth[month] = {};
        for (var state in d) {
            if (state !== 'Date') {
                interestDataByMonth[month][state] = +d[state];
            }
        }
    });

    // Color scale for interest values over time
    var colorScale = d3.scaleSequential(d3.interpolateGreys)
        .domain([0, d3.max(interestData, function (d) {
            return d3.max(Object.keys(d).map(function (key) {
                return key !== 'Date' ? +d[key] : 0;
            }));
        })]);

    // Color mapping for each of the 14 selected K-pop groups
    const kpopGroupColorScale = d3.scaleOrdinal() // Used colorbrewer qualitative color palette
        .domain(["BTS", "BLACKPINK", "PSY", "EXO", "DAY6", "Girls' Generation", "BigBang", "MAMAMOO", "MOMOLAND", "GOT7", "Stray Kids", "TOMORROW X TOGETHER", "ITZY", "ENHYPEN"])
        .range(["#cab2d6","#fb9a99","#02818a","#ffff99","#a6cee3","#d53e4f","#fdbf6f","#1f78b4","#b15928","#b2df8a","#e31a1c","#33a02c","#c51b7d","#ff7f00"])
    
    // Maps to colored PNG file for each Artist's associated music symbol, to display concert location
    const kpopConcertColorScale = d3.scaleOrdinal() // Used LUNAPIC web editor to edit music-note.png into kpopGroupColorScale versions
        .domain(["BTS", "BLACKPINK", "PSY", "EXO", "DAY6", "Girls' Generation", "BigBang", 
        "MAMAMOO", "MOMOLAND", "GOT7", "Stray Kids", "TOMORROW X TOGETHER", "ITZY", "ENHYPEN"])
        .range(["./symbols/BTS.png","./symbols/BLACKPINK.png","./symbols/PSY.png","./symbols/EXO.png","./symbols/DAY6.png","./symbols/GirlsGen.png","./symbols/BigBang.png",
        "./symbols/MAMAMOO.png","./symbols/MOMOLAND.png","./symbols/GOT7.png","./symbols/SKZ.png","./symbols/TXT.png","./symbols/ITZY.png","./symbols/ENHYPEN.png"])

    // Tooltip for each state that shows interest
    var tooltip = d3.select("#map").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    // Plot where concerts occurred using latitude and longitude coordinates
    function plotConcerts(month) {
        svg.selectAll(".concert").remove();

        var filteredConcerts = concertData.filter(function (d) {
            return d.Date === month;
        });

        svg.selectAll(".concert")
            .data(filteredConcerts)
            .enter().append("image")
            .attr("xlink:href", function(d){
                console.log(d.Artist);
                console.log(kpopConcertColorScale(d.Artist));
                return kpopConcertColorScale(d.Artist);
            }) // Music note symbol to represent concert occurence, makes choropleth map an advanced visualization per Professor Liu
            .attr("class", "concert")
            .attr("x", function (d) { return projection([+d.Longitude, +d.Latitude])[0]; })
            .attr("y", function (d) { return projection([+d.Longitude, +d.Latitude])[1]; })
            .attr("width", 25)
            .attr("height", 25)
            .style("opacity", 1)
            .on("mouseover", function (d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(d.ConcertInfo)
                    .style("background-color", function(){ // Tooltip color based on K-Pop group color
                        return kpopGroupColorScale(d.Artist);
                    })
                    .style("border", "1px #a6cee3")
                    .style("font-size", "18px")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function (d) {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
    }

    // Update map color whenever slider location is changed
    function updateMap(month) {
        svg.selectAll(".state")
            .data(states)
            .join("path")
            .attr("class", "state")
            .attr("d", path)
            .attr('fill', function (d) {
                var interest = interestDataByMonth[month][d.properties.name];
                return interest ? colorScale(interest) : 'white';
            })
            .attr('stroke', 'white')
            .on("mouseover", function (d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(d.properties.name + "<br/>" + (interestDataByMonth[month][d.properties.name] || "0"))
                    .style("background-color", "#f0f0f0")
                    .style("border", "1px solid #525252")
                    .style("font-size", "18px")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        plotConcerts(month); // Update concerts
    }

    // Legend
    const rendInterestLegend = () => {
        const legendScale = d3.scalePoint()
            .domain(ticks)
            .range([0, 300]);

        const axis = d3.axisBottom(legendScale)
            .tickSize(30);

        const g = svg.append("g")
            .attr("id", "legend")
            .attr("transform", "translate(" + [mapWidth * 0.40, 30] + ")")
        
        g.append("text")  
            .attr("x", 170) 
            .attr("y", 70)
            .attr("font-size", "18px")
            .style("fill", "black")
            .text("Interest Value Legend");

        g.selectAll("rect")
            .data(ticks)
            .join("rect")
            .attr("x", d => legendScale(d))
            .attr("y", 0)
            .attr("width", legendScale.step())
            .attr("height", 30)
            .attr("fill", d => color(d));

        g.call(axis)
            .selectAll(".tick text")
            .style("font-size", "16px")
            .style("text-anchor", "middle")
            .attr("dx", 300/11/2+"px"); // center label in middle of each box
    };
    rendInterestLegend();

    const rendGroupLegend = () => { // to display legend, used for both vis
        const svg = d3.select("svg");
        legendData = kpopGroupColorScale.domain();
        console.log(legendData)
    
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${0.66*width}, ${height*0.48})`);
        legend.append("text")
            .text("K-Pop Group Color Legend")
            .attr("font-size", "18px")
            .attr("x", 0)
            .attr("y", -10);
        let y = 0;
        for (const artist of legendData) {
            const legendItem = legend.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(0, ${y})`);
    
            legendItem.append("rect")
                .attr("width", 40)
                .attr("height", 20)
                .style("fill", kpopGroupColorScale(artist));
    
            legendItem.append("text")
                .attr("x", 45)
                .attr("y", 5)
                .attr("dy", "10")
                .text(artist);
    
            y += 20; 
        }
    }
    rendGroupLegend();

    // Time Slider
    var slider = d3.select("#slider")
        .append("svg")
        .attr("width", mapWidth)
        .attr("height", 100)
        .append("g")
        .attr("transform", "translate(" + [mapWidth / 16, 10] + ")");

    var months = Object.keys(interestDataByMonth);
    var monthScale = d3.scaleLinear()
        .domain([1, months.length])
        .range([0, mapWidth/1.5])
        .clamp(true);
    
    slider.append("text") // Display inital default display of "Jan 2012" on slider, will be overwritten "onchange"
        .attr("x", monthScale(months[0]))
        .attr("y", 40)
        .text("Jan 2012")
        .attr("text-anchor", "middle")
        .attr("font-size", "18px");
    
    slider.append("text") // Initialize feature title
        .attr("x", mapWidth*0.22) 
        .attr("y", 65)
        .attr("font-size", "18px")
        .style("fill", "black")
        .text("Time Slider: From Jan 2012 to Feb 2024");

    var sliderControl = d3.sliderBottom(monthScale)
        .ticks(months.length)
        .tickFormat(d3.format(""))

        .on('onchange', function (val) {
            var monthIndex = Math.round(val) - 1;
            var selectedMonth = months[monthIndex];
            updateMap(selectedMonth);

            slider.selectAll("text").remove();

            slider.append("text") // <Make feature title persistent despite "onchange" removing all text
                .attr("x", mapWidth*0.22) 
                .attr("y", 65)
                .attr("font-size", "18px")
                .style("fill", "black")
                .text("Time Slider: From Jan 2012 to Feb 2024");

            slider.append("text")
                .attr("x", monthScale(val))
                .attr("y", 40)
                .text(selectedMonth.slice(0))
                .attr("text-anchor", "middle")
                .attr("font-size", "18px");
        });
    slider.call(sliderControl);
    slider.selectAll(".tick text").remove();

    // Show first month view
    updateMap(Object.keys(interestDataByMonth)[0]);

}).catch(function (error) {
    console.error('Error loading or processing data:', error);
});