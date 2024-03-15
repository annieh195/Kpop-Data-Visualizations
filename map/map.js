Promise.all([
    d3.json('us_states.topojson'),
    d3.json('us.json'),
    d3.csv('interest_over_time.csv'),
    d3.csv('concerts.csv'),
    d3.csv("chart_data.csv")
]).then(function ([us, data, interestData, concertData, chartData]) {
    var states = topojson.feature(us, us.objects.us_states).features;

    // Dimensions
    var width = window.innerWidth,
        height = window.innerHeight * 0.85;
    // Map's dimensions
    var mapMargin = { top: 0, left: 30, right: 0, bottom: 0 },
        mapWidth = width / 2 + mapMargin.left - mapMargin.right,
        mapHeight = height - mapMargin.top - mapMargin.bottom;
    // Chart's dimensions
    const chartMargin = { top: 60, right: 50, bottom: 20, left: 60 };
    const chartWidth = width /2.3 - chartMargin.left - chartMargin.right;
    const chartHeight = height - chartMargin.top - (5.5 * chartMargin.bottom);

    // Define color scale for legend at discrete points
    const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const colors = d3.quantize(d3.interpolateGreys, 12);
    const color = d3.scaleThreshold()
        .domain(ticks)
        .range(colors);

    // Append SVG
    var svg = d3.select("#map")
        .append("svg")
        .attr("width", mapWidth + mapMargin.left + mapMargin.right)
        .attr("height", mapHeight + mapMargin.top + mapMargin.bottom)
        .style("position", "absolute");
    svg.append("text")
        .attr("x", 20)
        .attr("y", 40)
        .attr("font-size", "35px")
        .style("fill", "black")
        .text("K-Pop Revolution: The Impact on the US Music Industry");
    svg.append("text")
        .attr("x", 40)
        .attr("y", 85)
        .attr("font-size", "18px")
        .style("fill", "black")
        .text("Choropleth Map of Relative Interest in \"kpop\" Over Time w/ Concert Occurrences");
    svg.append("text")
        .attr("x", 40)
        .attr("y", 105)
        .attr("font-size", "18px")
        .style("fill", "black")
        .text("for 15 Industry Leading K-Pop Groups");

    const svgChart = d3.select("#chart")
        .append("svg")
        .attr("width", width/2)
        .style("position", "absolute")
        .style("top", "70px")
        .style("left", "710px")
        .attr("height", chartHeight + chartMargin.top + chartMargin.bottom+ 20)
        .append("g")
        .attr("transform", `translate(${chartMargin.left + mapWidth-680},${chartMargin.top-15})`)
        .attr("width", width/2-50);

    svgChart.append("text")
        .attr("x", -90)
        .attr("y", -20)
        .attr("font-size", "18px")
        .style("fill", "black")
        .text("Multiline Chart of Online Search Volume for 15 Industry Leading K-Pop Groups Over Time");
    svgChart.append("text")
        .attr("x", 80)
        .attr("y", 465)
        .attr("font-size", "18px")
        .style("fill", "black")
        .text("Volume of Google Searches in a Month vs Date by Month");

    // Define projection and path generator
    var projection = d3.geoAlbersUsa()
        .translate([mapWidth / 2-15, mapHeight / 2+55])
        .scale(950);
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

    // Parse dates
    const parseDate = d3.timeParse("%y-%b");
    chartData.forEach(d => {
        const dateParts = d.Date.split("-");
        d.Date = parseDate(`${dateParts[0]}-${dateParts[1]}`);
    });

    // Extract column names for keywords
    const keywords = chartData.columns.slice(1);

    // Initially set the selected data to just "kpop" for the author-driven stage
    let selectedKeywords = ["kpop"];
    let notSelectedKeywords = keywords.filter(keyword => !selectedKeywords.includes(keyword));

    // Set up scales and axes
    const x = d3.scaleTime().range([0, chartWidth]);
    const y = d3.scaleLinear().range([chartHeight, 0]);

    // Color scale for interest values over time
    var colorScale = d3.scaleSequential(d3.interpolateGreys)
        .domain([0, d3.max(interestData, function (d) {
            return d3.max(Object.keys(d).map(function (key) {
                return key !== 'Date' ? +d[key] : 0;
            }));
        })]);

    // Color mapping for each of the 15 selected K-pop groups
    const kpopGroupColorScale = d3.scaleOrdinal() // Used colorbrewer qualitative color palette
        .domain(["BTS", "BLACKPINK", "PSY", "EXO", "DAY6", "Girls' Generation", "BIGBANG", "MAMAMOO", "MOMOLAND", "GOT7", "Stray Kids", "TOMORROW X TOGETHER", "ITZY", "ENHYPEN", "(G)I-DLE", "The Beatles", "kpop"])
        .range(["#cab2d6","#fb9a99","#008080","#ffff99","#a6cee3","#d53e4f","#fdbf6f","#1f78b4","#b15928","#b2df8a","#e31a1c","#33a02c","#c51b7d","#ff7f00","#7e00bf","#d9d9d9","#006d2c"]);
    // Maps to colored PNG file for each Artist's associated music symbol, to display concert location
    const kpopConcertColorScale = d3.scaleOrdinal() // Used LUNAPIC web editor to edit music-note.png into kpopGroupColorScale versions
        .domain(["BTS", "BLACKPINK", "PSY", "EXO", "DAY6", "Girls' Generation", "BIGBANG", "MAMAMOO", "MOMOLAND", "GOT7", "Stray Kids", "TOMORROW X TOGETHER", "ITZY", "ENHYPEN", "(G)I-DLE"])
        .range(["./symbols/BTS.png", "./symbols/BLACKPINK.png", "./symbols/PSY.png", "./symbols/EXO.png", "./symbols/DAY6.png", "./symbols/GirlsGen.png", "./symbols/BIGBANG.png", "./symbols/MAMAMOO.png", "./symbols/MOMOLAND.png", "./symbols/GOT7.png", "./symbols/SKZ.png", "./symbols/TXT.png", "./symbols/ITZY.png", "./symbols/ENHYPEN.png", "./symbols/GIDLE.png"]);

    // Tooltip for each state that shows interest
    var tooltip = d3.select("#map").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y);

    // Add x-axis
    const xAxisElement = svgChart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${chartHeight})`);

    // Add y-axis
    const yAxisElement = svgChart.append("g")
        .attr("class", "y-axis");

    // Initialize x and y scales domain
    x.domain(d3.extent(chartData, d => d.Date));
    y.domain([0, d3.max(chartData, d => d3.max(selectedKeywords, key => +d[key]))]);

    // Update axes with transition
    xAxisElement.transition().duration(500).call(xAxis);
    yAxisElement.transition().duration(500).call(yAxis);

    // Plot where concerts occurred using latitude and longitude coordinates
    function plotConcerts(month) {
        svg.selectAll(".concert").remove();

        var filteredConcerts = concertData.filter(function (d) {
            return d.Date === month;
        });

        svg.selectAll(".concert")
            .data(filteredConcerts)
            .enter().append("image")
            .attr("xlink:href", function (d) {
                return kpopConcertColorScale(d.Artist);
            }) // Music note symbol to represent concert occurence, makes choropleth map an advanced visualization per Professor Liu
            .attr("class", "concert")
            .attr("x", function (d) { return projection([+d.Longitude, +d.Latitude])[0]-12.5; })
            .attr("y", function (d) { return projection([+d.Longitude, +d.Latitude])[1]-12.5; })
            .attr("width", 25)
            .attr("height", 25)
            .style("opacity", 1)
            .on("mouseover", function (d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(d.ConcertInfo)
                    .style("background-color", function () { // Tooltip color based on K-Pop group color
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
            .attr('stroke', 'black')
            .on("mouseover", function (d) {
                tooltip.transition()
                    .duration(100)
                    .style("opacity", .9);
                console.log(d.properties);
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

        svg.selectAll(".state-label")
            .data(states)
            .join("text")
            .attr("class", "state-label")
            .attr("x", function (d) {
                if (["Rhode Island", "Delaware"].includes(d.properties.name)) {
                    return path.centroid(d)[0] + 35;
                } else {
                    return path.centroid(d)[0];
                }
            })
            .attr("y", function (d) {
                return path.centroid(d)[1];
            })
            .text(function (d) {
                if (d.properties.name === "District of Columbia") {
                    return "";
                } else {
                    var interest = interestDataByMonth[month][d.properties.name];
                    return interest || "0";
                }
            })
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .style("font-size", "15px")
            .style("fill", function (d) {
                var interest = interestDataByMonth[month][d.properties.name];
                if (["Rhode Island", "Delaware"].includes(d.properties.name)) {
                    return "black";
                } else {
                    return interest < 50 ? "black" : "white";
                }
            });

        svg.selectAll(".line")
            .data(states)
            .join("line")
            .attr("class", "line")
            .attr("x1", function (d) {
                return path.centroid(d)[0];
            })
            .attr("y1", function (d) {
                return path.centroid(d)[1];
            })
            .attr("x2", function (d) {
                if (["Rhode Island", "Delaware"].includes(d.properties.name)) {
                    return path.centroid(d)[0] + 25;
                } else {
                    return path.centroid(d)[0];
                }
            })
            .attr("y2", function (d) {
                return path.centroid(d)[1];
            })
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        plotConcerts(month); // Update concerts
    }

    // Interest Map Legend
    const rendInterestLegend = () => {
        const legendScale = d3.scalePoint()
            .domain(ticks)
            .range([0, 300]);

        const axis = d3.axisBottom(legendScale)
            .tickSize(30);

        const g = svg.append("g")
            .attr("id", "legend")
            .attr("transform", "translate(" + [mapWidth * 0.40, 120] + ")")

        g.append("text")
            .attr("x", 170)
            .attr("y",-5)
            .attr("font-size", "15px")
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
            .attr("dx", 300 / 11 / 2 + "px"); // center label in middle of each box
    };
    rendInterestLegend();

    // UNUSED
    const rendGroupLegend = () => { // To display color legend, used for both vis
        const svg = d3.select("svg");
        legendData = kpopGroupColorScale.domain();
        //console.log(legendData)

        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${0.66 * width}, ${height * 0.40})`);
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
    //rendGroupLegend();

    var slider = d3.select("#slider")
        .append("svg")
        .attr("width", mapWidth-100)
        .attr("height", 88)
        .style("position", "absolute")
        .style("top", "585px")
        .style("left", "45px")
        .append("g")
        .attr("transform", "translate(" + [mapWidth / 16, 10] + ")");

    var months = Object.keys(interestDataByMonth);
    var monthScale = d3.scaleLinear()
        .domain([1, months.length])
        .range([0, mapWidth / 1.5])
        .clamp(true);

    slider.append("text") // Display inital default display of "Jan 2012" on slider, will be overwritten "onchange"
        .attr("x", monthScale(months[0]))
        .attr("y", 40)
        .text("Jan 2012")
        .attr("text-anchor", "middle")
        .attr("font-size", "18px");

    slider.append("text") // Initialize feature title
        .attr("x", mapWidth * 0.16)
        .attr("y", 55)
        .attr("font-size", "18px")
        .style("fill", "black")
        .text("Time Slider: From Jan 2012 to Feb 2024");

    var selectedMonth;
    var sliderControl = d3.sliderBottom(monthScale)
        .ticks(months.length)
        .tickFormat(d3.format(""))

        .on('onchange', function (val) {
            var monthIndex = Math.round(val) - 1;
            selectedMonth = months[monthIndex];
            updateMap(selectedMonth);
            drawLines(selectedKeywords, selectedMonth);

            slider.selectAll("text").remove();

            slider.append("text") // <Make feature title persistent despite "onchange" removing all text
                .attr("x", mapWidth * 0.16)
                .attr("y", 55)
                .attr("font-size", "18px")
                .style("fill", "black")
                .text("Time Slider: From Jan 2012 to Feb 2024");

            //console.log(selectedMonth.slice(0));
            slider.append("text")
                .attr("x", monthScale(val))
                .attr("y", 35)
                .text(selectedMonth.slice(0))
                .attr("text-anchor", "middle")
                .attr("font-size", "18px");
        });
    slider.call(sliderControl);
    slider.selectAll(".tick text").remove();

    // Show first month view
    updateMap(Object.keys(interestDataByMonth)[0]);

    let autoMode = true;
    // Function to draw lines and update axes
    // Function to draw lines and update axes
    function drawLines(selectedKeywords, selectedMonth) {
        const selectedDate = new Date(selectedMonth);
        const filteredData = chartData.filter(d => d.Date <= selectedDate);
        notSelectedKeywords.forEach(keyword => {
            // Remove existing lines
            svgChart.selectAll(".line-" + keyword.replace(" ", "").replace("'", "")).remove()
                .transition()
                .duration(1000);
        });

        // Update y scales domain
        if (autoMode) {
            selectedKeywords = ["kpop"];
            // y.domain([0, d3.max(filteredData, d => +d["kpop"])]);
        } else {
            selectedKeywords = keywords.filter(keyword => !notSelectedKeywords.includes(keyword));
            y.domain([0, d3.max(filteredData, d => d3.max(selectedKeywords, key => +d[key]))]);
            // Update axes with transition
            xAxisElement.transition().duration(1000).call(xAxis);
            yAxisElement.transition().duration(1000).call(yAxis);
        }

        // Plot each keyword as a line with transition
        selectedKeywords.forEach(keyword => {
            // Define line function inside the loop to properly reference the current keyword
            const line = d3.line()
                .x(d => x(d.Date))
                .y(d => y(+d[keyword]));

            svgChart.selectAll(".line-" + keyword.replace(" ", "").replace("'", ""))
                .data([filteredData])
                .join("path")
                .attr("class", "line line-" + keyword.replace(" ", "").replace("'", ""))
                .attr("fill", "none")
                .attr("stroke", kpopGroupColorScale(keyword))
                .attr("stroke-width", keyword === "kpop" ? 4 : 2)
                .transition()
                .duration(1000)
                .attr("d", line);

            if (keyword === "kpop") {
                const datesToPlot = [
                    { month: 12, year: 2012, text: '“GANGNAM STYLE” or “강남스타일” by PSY was released on July 15, 2012 on YouTube. On December 21, 2012, it became the first video to reach 1 billion views on YouTube.'}, // Dec 2012
                    { month: 4, year: 2017, text: 'On April 10, 2017, BTS was nominated for the 2017 Billboard Music Awards in the Top Social Artist category for the first time. This makes them the first K-pop group to be nominated for an American music award.' }, // Apr 2017
                    { month: 6, year: 2018, text: '“DDU-DU DDU-DU” or “뚜두뚜두” by BLACKPINK was released on June 15, 2018, on YouTube. As of March 10, 2024, the video has 2,177,028,421 views on YouTube. This song is the 2nd most viewed video/song by a K-pop artist on YouTube.' },  // Jun 2018
                    { month: 9, year: 2018, text: 'On September 24, 2018, BTS was invited by UNICEF to speak to the United Nations Assembly about its global #ENDviolence campaign. During his speech, BTS leader RM urged the world to love and speak for themselves.'},
                    { month: 5, year: 2019, text: 'On May 1, 2019, BTS attended the Billboard Music Awards for the 3rd time and won the Top Social Artist and Top Duo/Group awards. Later in the year, they wre also nominated for Tour of the Year, Favorite Social Artist, Favorite Duo or Group Pop/Rock at the American Music Awards and won all of those categories.'},
                    { month: 7, year: 2019, text: 'The VMAs become the first major award show to add a K-Pop cateogry, where groups like BTS, Blackpink, EXO, and Tomorrow-X-Together were all nominated for music videos.'},
                    { month: 11, year: 2020, text: 'On November 24, 2020, BTS was nominated for the 2021 Grammy Award in the Best Pop Duo/Group category for the 1st time for their song “Dynamite”. While they unfortunately did not win, they were the first K-pop artist to receive a nomination.'},
                    { month: 4, year: 2021, text: 'On April 29, 2021, BLACKPINK was nominated for the 2021 Billboard Music Awards in the Top Social Artist category for the 1st time. They were the first female K-pop group to be nominated for a major American music award.'},
                    { month: 11, year: 2021, text: 'On November 19, 2021 Big Hit/HYBE entertainment group hit its all time highest stock price at 400,500 Korean Won ~ 305 USD and Cube Entertainment also peaked at 26,700 Korean Won ~ 20 USD'},
                    { month: 10, year: 2022, text: 'On October 13, 2022, the American Music Awards added the Favorite K-pop Artist category.'},
                    { month: 3, year: 2023, text: 'On March 10, 2023, SM Entertainment, the company that houses groups such as EXO, NCT, and Red Velvet, hit its all-time highest stock price at 147,000 KRW ~ 112 USD.'},
                    { month: 5, year: 2023, text: 'On May 26, 2023, YG Entertainment (와이지엔터테인먼트), the company that houses groups such as BLACKPINK, iKON, AKMU, and BIGBANG, hit its all-time highest stock price at 96,000 KRW ~ 70 USD.'},
                    { month: 6, year: 2023, text: 'On June 16, 2023, JYP, the company that houses groups such as ITZY, Day6, Wonder Girls, and Stray Kids, hit its all-time peak stock price at 136,000 KRW ~ 103 USD.'},
                    { month: 11, year: 2023, text: 'On November 19, 2023, while BLACKPINK did not attend the 2023 Billboard Music Awards, they won the Top K-pop Touring Artist award. They were the first female K-pop group to receive an award from a major American music award.'}
                ];

                datesToPlot.forEach(dateInfo => {
                    const dateToPlot = new Date(dateInfo.year, dateInfo.month);
                    const dataForDate = filteredData.find(d => d.Date.getMonth() === dateToPlot.getMonth() && d.Date.getFullYear() === dateToPlot.getFullYear());
                    if (dataForDate) {
                        svgChart.selectAll(".dot-" + dateInfo.year + "-" + dateInfo.month)
                            .data([dataForDate])
                            .join("circle")
                            .attr("class", "dot dot-" + dateInfo.year + "-" + dateInfo.month)
                            .attr("cx", d => x(d.Date))
                            .attr("cy", d => y(+d["kpop"]))
                            .attr("r", 7)
                            .style("fill", "white")
                            .attr("stroke", "black")
                            .attr("stroke-width", "2px")
                            .style("display", "block")
                            .on("mouseover", function(event, d) {
                                // const tooltipX = d3.mouse(this)[0] - 250;
                                // const tooltipY = d3.mouse(this)[1] + 10;
                                
                                keyEventTooltip.select(".tooltip-text")
                                    .html(dateInfo.text)
                                    .style("top", "10 px")
                                    .style("left", "10 px");

                                keyEventTooltip.style("visibility", "visible")
                                    .attr("transform", `translate(${tooltipX},${tooltipY})`);;
                            })
                            .on("mouseout", function () {
                                keyEventTooltip.style("visibility", "hidden");
                            });   
                    }
                });
            }
        });
        // Update legend item opacity based on selectedKeywords
        colorLegend.selectAll("rect")
            .style("opacity", d => selectedKeywords.includes(d) ? 1 : 0.3);

        colorLegend.selectAll("text")
            .style("opacity", d => selectedKeywords.includes(d) ? 1 : 0.3);
    }

    // Append a tooltip to the chart
    const keyEventTooltip = svgChart.append("g")
        .attr("class", "keyEventTooltip")
        .style("visibility", "hidden")
        .attr("width", 200)
        .attr("height", 500);

    keyEventTooltip.append("rect")
        .attr("width", 515)
        .attr("height", 80)
        .attr("fill", "#006d2c")
        .style("opacity", 0.8);

    keyEventTooltip.append("foreignObject")
        .attr("width", 500)
        .attr("height", 100)
        .append("xhtml:div")
        .style("width", "500px")
        .style("height", "50px")
        .style("word-wrap", "break-word")
        .style("text-align", "left")
        .style("padding", "5px")
        .attr("class", "tooltip-text")
        .style("font-size", "15px");

    keyEventTooltip.append("xhtml:div")
        .style("font-size", "4px");

    const colorLegend = svgChart.selectAll(".legend")
        .data(keywords)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(-615,${i * 20+130})`)
        .on("click", function (event, d) {
            if (selectedKeywords.includes(keywords[d])) {
                selectedKeywords = selectedKeywords.filter(item => item !== keywords[d]);
                notSelectedKeywords.push(keywords[d]);
                if (keywords[d] == "kpop") {
                    d3.selectAll(".dot").style("display", "none");
                }
            } else {
                selectedKeywords.push(keywords[d]);
                notSelectedKeywords = notSelectedKeywords.filter(item => item !== keywords[d]);
                if (keywords[d] == "kpop") {
                    d3.selectAll(".dot").style("display", "block");
                }
            }
            // Redraw lines and update axes based on updated selectedKeywords
            drawLines(selectedKeywords, selectedMonth);
        });
        colorLegend.append("rect")
            .attr("x", chartWidth - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", d => kpopGroupColorScale(d))
            .style("opacity", d => selectedKeywords.includes(d) ? 1 : 0.3); // Adjust opacity based on inclusion in selectedKeywords
    
        colorLegend.append("text")
            .attr("x", chartWidth - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(d => d)
            .style("opacity", d => selectedKeywords.includes(d) ? 1 : 0.3); // Adjust opacity based on inclusion in selectedKeywords
    

    // Define a function to automatically increment the slider
    function autoIncrementSlider() {
        const sliderValue = sliderControl.value();
        const maxValue = sliderControl.max();
        if (sliderValue < maxValue) {
            sliderControl.value(sliderValue + 1);
            const val = sliderControl.value();
            const monthIndex = Math.round(val) - 1;
            const selectedMonth = months[monthIndex];

            // Clear all lines except for the kpop line
            svgChart.selectAll(".line").remove();

            // Redraw only the kpop line
            drawKpopLine(selectedMonth);

            // Update the tick text
            slider.selectAll("text").remove();
            const tickText = slider.append("text")
                .attr("x", monthScale(val))
                .attr("y", 30)
                .text(selectedMonth.slice(3, 15).replace("01 ", ""))
                .attr("text-anchor", "middle")
                .attr("font-size", "15px");
        } else {
            clearInterval(intervalId); // Stop auto-incrementing when reaching the end
            autoMode = false;
            // selectedKeywords = keywords;
            document.getElementById("interactButton").style.display = "inline";
            document.getElementById("replayButton").style.display = "inline";
            document.getElementById("detailedReplayButton").style.display = "inline";
        }
    }

    // Function to draw only the kpop line
    function drawKpopLine(selectedMonth) {
        const selectedDate = new Date(selectedMonth);
        const filteredData = chartData.filter(d => d.Date <= selectedDate);

        // Update y scale domain based on filtered data
        y.domain([0, d3.max(chartData, d => +d["kpop"])]);

        // Update y-axis without transition
        yAxisElement.call(yAxis);

        // Plot the kpop line with transition
        const kpopLine = d3.line()
            .x(d => x(d.Date))
            .y(d => y(+d["kpop"]));

        svgChart.append("path")
            .datum(filteredData)
            .attr("class", "line line-kpop")
            .attr("fill", "none")
            .attr("stroke", kpopGroupColorScale("kpop"))
            .attr("stroke-width", 5)
            .attr("d", kpopLine);
    }

    // Set up interval for automatic slider increment
    let intervalId = setInterval(autoIncrementSlider, 150);
    let timeoutId;

    // Add a replay button event listener
    document.getElementById('replayButton').addEventListener('click', function() {
        clearInterval(intervalId); // Clear any existing interval
        clearTimeout(timeoutId); // Clear any existing timeouts
        autoMode = true;
        selectedKeywords = ["kpop"]; // Reset selectedKeywords to initial state
        notSelectedKeywords = keywords.filter(keyword => !selectedKeywords.includes(keyword));
        sliderControl.value(1); // Reset slider to initial position
        autoIncrementSlider(); // Redraw the chart
        intervalId = setInterval(autoIncrementSlider, 150); // Restart auto-incrementing
        document.getElementById("interactButton").style.display = "inline";
        d3.selectAll(".dot").style("display", "none");
    });
    document.getElementById('detailedReplayButton').addEventListener('click', function() {
        clearInterval(intervalId); // Clear any existing interval
        clearTimeout(timeoutId); // Clear any existing timeouts
        autoMode = true;
        selectedKeywords = ["kpop"]; // Reset selectedKeywords to initial state
        notSelectedKeywords = keywords.filter(keyword => !selectedKeywords.includes(keyword));
        sliderControl.value(1); // Reset slider to initial position
        
        function displayMessage(duration, annotationText, clearAnnotation = false){
            setTimeout(function(){
                if(clearAnnotation){
                    document.getElementById("annotationText").innerText = "";
                }else{
                    document.getElementById("annotationText").innerText = annotationText;
                }
            }, duration);
        }
        // Timed annotations for extended replay
        displayMessage(500,"In the last decade or so, K-Pop, or Korean Pop music, has dramatically impacted the US music industry.");
        displayMessage(3100,"Korean artists have headlined at major US music festivals like Coachella, were nominated for Grammys, and spoke at the United Nations.");
        displayMessage(5200,"Groups like BTS and Blackpink have had multiple sold-out concerts with over 600,000 attendees over 4 days at SOFI stadium and the Rose Bowl Stadium, the same stadiums that artists like Taylor Swift use for concerts.");
        displayMessage(9800,"Tickets have sold for nearly 4,000 USD.");
        displayMessage(11400,"K-Pop songs like “Butter” have held #1 spot on the Billboard Music charts for 10 weeks straight, and others have stayed on the Hot 100 for over half a year straight.");
        displayMessage(14600,"What is unique about the K-Pop industry?");
        displayMessage(16800,"In Korea, several major entertainment companies like BigHit and JYP manage all music and artists.");
        displayMessage(19400,"These major corporations recruit and train talented artists from youth and each individual artist has an area of focus - singing, dancing, rapping, visual, or another distinct skill.");
        displayMessage(23000,"Unlike the majority of US artists, artists in K-Pop debut within artist groups that can range from 2 to over 20 members!");
        displayMessage(25600,"Each artist group releases music together, with specific styles and visual themes.");
        displayMessage(28200,"Music releases are highly coordinated efforts, and artist groups perform frequently. K-Pop music is also highly established in Korea - the Korean broadcast group SBS runs weekly, monthly, and yearly performances like Inkigayo where various artists perform very often. ");
        displayMessage(32800,"There are many ways for fans to interact with artists - groups will hold fan meets, go live on various social media platforms, and sell various collectibles.");
        displayMessage(28000,"While the music culture associated with the K-Pop industry is highly different from the music culture in the US music industry, in the last decade K-Pop has gradually assimilated into the US, topping music charts and winning awards.");
        displayMessage(35800,"Even in our everyday lives at UC Davis, the impact is clear - multiple K-Pop dance teams have been founded by UCD students, the Men’s basketball team just hosted a K-Pop themed game, and this year if you listened to K-Pop, Spotify Wrapped said you listened to the same music as people in Davis, CA.");
        displayMessage(45400,"While many have noticed the distinct growth of K-Pop influence, there hasn’t been a concrete study of how K-Pop influence has grown to the place it is now.");
        displayMessage(50000,"Through these visualizations, you’ll have an opportunity to learn more about the K-Pop revolution in the US.");
        displayMessage(54600,"Click \"Replay Visualization\" to see a sped up overview of the visualization, or click \"Interact\" to interact with the full visualization!");
        displayMessage(58400,"ignore",true);
        
        autoIncrementSlider(); // Redraw the chart
        intervalId = setInterval(autoIncrementSlider, 350); // Restart auto-incrementing
        document.getElementById("interactButton").style.display = "none";
        document.getElementById("replayButton").style.display = "none";
        d3.selectAll(".dot").style("display", "none");
    });
    // Add an event listener for the interact button
    document.getElementById('interactButton').addEventListener('click', function() {
        clearInterval(intervalId); // Clear any existing interval
        clearTimeout(timeoutId); // Clear any existing timeouts
        autoMode = false;
        selectedKeywords = keywords; // Show all keywords
        notSelectedKeywords = [];
        sliderControl.value(1); // Reset slider to initial position
        slider.selectAll("text").remove(); // Remove slider text
        document.getElementById("interactButton").style.display = "none";
        d3.selectAll(".dot").style("display", "none");
    });
}).catch(function (error) {
    console.error('Error loading or processing data:', error);
});