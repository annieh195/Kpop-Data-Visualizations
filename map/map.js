Promise.all([
    d3.json('us_states.topojson'),
    d3.json('us.json'),
    d3.csv('interest_over_time.csv')
]).then(function ([us, data, csvData]) {
    var states = topojson.feature(us, us.objects.us_states).features;

    var width = window.innerWidth * 0.8,
        height = window.innerHeight * 0.8;

    var mapMargin = { top: 0, left: 0, right: 0, bottom: 0 },
        mapWidth = width - mapMargin.left - mapMargin.right,
        mapHeight = height - mapMargin.top - mapMargin.bottom;

    const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const color = d3.scaleThreshold()
        .domain(ticks)
        .range(d3.schemeBlues[9]);

    var svg = d3.select("#map")
        .append("svg")
        .attr("width", mapWidth + mapMargin.left + mapMargin.right)
        .attr("height", mapHeight + mapMargin.top + mapMargin.bottom)
        .append("g")
        .attr("transform", "translate(" + mapMargin.left + "," + mapMargin.top + ")");

    // Define projection and path generator (also for later use)
    var projection = d3.geoAlbersUsa()
        .translate([mapWidth / 2, mapHeight / 2])
        .scale(1000);
    var path = d3.geoPath().projection(projection);

    // CSV with states and interest values by months
    var interestDataByMonth = {};
    csvData.forEach(function (d) {
        var month = d.Date;
        interestDataByMonth[month] = {};
        for (var state in d) {
            if (state !== 'Date') {
                interestDataByMonth[month][state] = +d[state];
            }
        }
    });

    // Color scale for interest values over time
    var colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, d3.max(csvData, function (d) {
            return d3.max(Object.keys(d).map(function (key) {
                return key !== 'Date' ? +d[key] : 0;
            }));
        })]);

    // Tooltip for each state that shows interest
    var tooltip = d3.select("#map").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    function updateMap(month) {
        svg.selectAll(".state")
            .data(states)
            .join("path")
            .attr("class", "state")
            .attr("d", path)
            .attr('fill', function (d) {
                var interest = interestDataByMonth[month][d.properties.name];
                return interest ? colorScale(interest) : 'gray';
            })
            .attr('stroke', 'white')
            .on("mouseover", function (d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(d.properties.name + "<br/>" + (interestDataByMonth[month][d.properties.name] || "0"))
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    }

    // Legend
    const rendLegend = () => {
        const legendScale = d3.scalePoint()
            .domain(ticks)
            .range([0, 200]);

        const axis = d3.axisBottom(legendScale)
            .tickSize(20);

        const g = svg.append("g")
            .attr("id", "legend")
            .attr("transform", "translate(" + [mapWidth * 2 / 3, 100] + ")");

        g.selectAll("rect")
            .data(ticks)
            .join("rect")
            .attr("x", d => legendScale(d))
            .attr("y", 0)
            .attr("width", legendScale.step())
            .attr("height", 20)
            .attr("fill", d => color(d));

        g.call(axis);
    };
    rendLegend();

    // Time Slider
    var slider = d3.select("#slider")
        .append("svg")
        .attr("width", mapWidth)
        .attr("height", 100)
        .append("g")
        .attr("transform", "translate(" + [mapWidth / 4, 20] + ")");

    var months = Object.keys(interestDataByMonth);
    var monthScale = d3.scaleLinear()
        .domain([1, months.length])
        .range([0, mapWidth / 2])
        .clamp(true);

    var sliderControl = d3.sliderBottom(monthScale)
        .ticks(months.length)
        .tickFormat(d3.format(""))
        .default(1)
        .on('onchange', function (val) {
            var monthIndex = Math.round(val) - 1;
            var selectedMonth = months[monthIndex];
            updateMap(selectedMonth);

            slider.selectAll("text").remove();

            var tickText = slider.append("text")
                .attr("x", monthScale(val))
                .attr("y", 40)
                .text(selectedMonth.slice(0))
                .attr("text-anchor", "middle")
                .attr("font-size", "12px");
        });

    slider.call(sliderControl);
    slider.selectAll(".tick text").remove();

    // Show first month view
    updateMap(Object.keys(interestDataByMonth)[0]);

}).catch(function (error) {
    console.error('Error loading or processing data:', error);
});
