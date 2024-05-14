// Listen for the DOM content to be fully loaded before running the fetchDataAndPlot function
document.addEventListener('DOMContentLoaded', function() {
    fetchDataAndPlot();
});

// Initialize variables to hold country and region data
let countryData = null;
let regionData = null;

// Function to fetch and plot data
function fetchDataAndPlot() {
    if (!countryData) {  // Check if country data has not been loaded
        d3.json('data/countries.json').then(data => {
            countryData = data;  // Store fetched data in countryData variable
            updateChart(countryData, 'population', 'country');  // Update the chart with initial settings
        });
    } else {
        updateChart(countryData, 'population', 'country');  // Use existing data to update the chart
    }
}

// Function to update data based on user selections
function updateData() {
    const dataSelect = document.getElementById('dataSelect').value;  // Get selected data type
    const sortByCountry = document.getElementById('sortByCountry').checked;  // Check if sorting by country
    const sortType = sortByCountry ? 'country' : 'region';  // Determine sort type

    // Handle region sort type
    if (sortType == "region") {
        if (regionData) {
            updateChart(regionData, dataSelect, sortType);  // Update chart if region data is available
        } else {
            if (!countryData) {  // Fetch country data if not already loaded
                d3.json('data/countries.json').then(data => {
                    countryData = data;
                });
            } else {
                // Aggregate countries into regions
                const regions = {};
                countryData.forEach(country => {
                    const region = country.region;
                    if (region) { 
                        if (!regions[region]) {
                            regions[region] = {
                                countries: [],
                                timezones: new Set()  // Use a Set to avoid duplicate timezones
                            };
                        }
                        regions[region].countries.push(country.name);
                        country.timezones.forEach(timezone => {
                            regions[region].timezones.add(timezone);
                        });
                    }
                });

                // Finalize the regions data structure
                const finalRegions = {};
                for (const [key, value] of Object.entries(regions)) {
                    finalRegions[key] = {
                        countries: value.countries,
                        timezones: [...value.timezones]  // Convert Set to array for timezones
                    };
                }
                regionData = Object.entries(finalRegions).map(([region, details]) => ({
                    region: region,
                    countries: details.countries.length,
                    timezones: details.timezones.length 
                }));
                updateChart(regionData, dataSelect, sortType);
            }
        }
    } else {
        // Handle country sort type
        if (countryData) {
            updateChart(countryData, dataSelect, sortType);
        } else {
            // Fetch country data if not already loaded
            d3.json('data/countries.json').then(data => {
                countryData = data;
                updateChart(countryData, dataSelect, sortType);
            });
        }
    }
}

// Function to update selection options based on sort type
function updateOptions() {
    const sortByCountry = document.getElementById('sortByCountry').checked;
    const sortByRegion = document.getElementById('sortByRegion').checked;
    const select = document.getElementById('dataSelect');

    select.options.length = 0;  // Clear previous options

    // Add options based on sort type
    if (sortByCountry) {
        select.options.add(new Option("Population size", "population"));
        select.options.add(new Option("Number of borders", "borders"));
        select.options.add(new Option("Number of timezones", "timezones"));
        select.options.add(new Option("Number of languages", "languages"));
    } else if (sortByRegion) {
        select.options.add(new Option("Number of countries in the region", "countriesInRegion"));
        select.options.add(new Option("Number of unique timezones in the region", "uniqueTimezones"));
    }
    updateData();  // Refresh data based on new options
}

// Function to update the visualization (chart)
function updateChart(data, dataSelect, sortType) {
    const svgWidth = 800, svgHeight = 800;  // Define SVG dimensions
    const svg = d3.select('#chart').html('').append('svg')
                 .attr('width', svgWidth)
                 .attr('height', svgHeight);  // Create SVG element

    let valueAccessor;  // Function to access data values
    let radiusScale;    // D3 scale for bubble sizes
    let maxValue;       // Maximum value for data scaling
    let getFontSize;    // Function to get font size based on bubble size
    let getDx;          // Function to adjust text position
    let getName;        // Function to get name based on sort type
    let d3Strength;     // Strength of force simulation

    // Set parameters based on sort type
    if (sortType === "country") {
        if (dataSelect === "population") {
            valueAccessor = d => +d[dataSelect];
            maxValue = d3.max(data, valueAccessor);
            radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([5, 100]);
            getFontSize = radius => `${Math.max(1, radius / 3)}px`;
            getDx = radius => `-${Math.max(3.3, radius / 28)}em`;
        } else {
            valueAccessor = d => Array.isArray(d[dataSelect]) ? d[dataSelect].length : 0;
            maxValue = d3.max(data, valueAccessor);
            radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([5, 40]);
            getFontSize = radius => `${Math.max(1, radius / 3)}px`;
            getDx = radius => `-${Math.max(1.3, radius / 28)}em`;
        }
        getName = d => d.alpha3Code;
        d3Strength = 5;
    } else {
        if (dataSelect === "countriesInRegion") {
            valueAccessor = d => d.countries;
        } else {
            valueAccessor = d => d.timezones;
        }
        getName = d => d.region;
        maxValue = d3.max(data, valueAccessor);
        radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([40, 100]); 
        getFontSize = radius => `${Math.max(1, radius / 3)}px`;
        getDx = radius => `-${Math.max(2.4, radius / 45)}em`;
        d3Strength = 200;
    }

    // Process nodes for visualization
    const nodes = data.map(d => ({
        value: valueAccessor(d),
        radius: radiusScale(valueAccessor(d)),
        name: getName(d),
        additionalInfo: sortType === "country" ? {realName: d.name, capital: d.capital, region: d.region, population: d.population, nativeName: d.nativeName, borders: d.borders, languages: d.languages, timezones: d.timezones} : {countries: d.countries, timezones: d.timezones},
        fontsize: getFontSize(radiusScale(valueAccessor(d))),
        dx: getDx(radiusScale(valueAccessor(d))),
        x: Math.random() * svgWidth,
        y: Math.random() * svgHeight
    }));

    // Update the table with sorted node data and current sort type
    updateTable(nodes, sortType);

    // Configure force simulation for bubble positioning
    const simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(d3Strength))
        .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
        .force("collision", d3.forceCollide().radius(d => d.radius + 2))
        .on("tick", ticked);

    // Define and configure tooltips for additional information on hover
    const tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("padding", "10px")
        .style("background", "white")
        .style("border", "1px solid black")
        .style("pointer-events", "none");

    // Create bubbles and bind data
    const bubbles = svg.selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", d => d.radius)
        .attr("fill", "black")  // Default fill, consider updating to match desired visual
        .on("mouseover", function(event, d) {
            let tooltipContent;
            if (sortType === "country") {
                tooltipContent = `Name: ${d.name}<br>Real Name: ${d.additionalInfo.realName}<br>Capital: ${d.additionalInfo.capital}<br>Region: ${d.additionalInfo.region}<br>Population: ${d.additionalInfo.population}<br>Native Name: ${d.additionalInfo.nativeName}`;
            } else {
                tooltipContent = `Region: ${d.name}<br>Countries: ${d.additionalInfo.countries}<br>Timezones: ${d.additionalInfo.timezones}`;
            }
        
            tooltip.html(tooltipContent)
                   .style("visibility", "visible")
                   .style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY + 10) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        });

    // Add labels to each bubble
    const labels = svg.selectAll("text")
        .data(nodes)
        .enter().append("text")
        .text(d => d.name) 
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("dominant-baseline", "middle")
        .attr("dy", "-1em") 
        .style("font-size", d => d.fontsize) 
        .style("pointer-events", "none"); 
    
    labels.append("tspan")
        .attr("dx", d => d.dx) 
        .attr("dy", "1.2em") 
        .style("font-size", d => d.fontsize) 
        .text(d => {
            return d.value;  // Display value inside the bubble
        });

    // Function to adjust bubble positions on simulation tick
    function ticked() {
        bubbles.attr("cx", d => d.x)
                .attr("cy", d => d.y);
        labels.attr("x", d => d.x)
                .attr("y", d => d.y + (d.radius / 4)); 
    }
}

// Function to update and display the data table
function updateTable(data, sortType) {
    console.log(data);  // Log data for debugging
    const table = document.getElementById("data-table");
    const thead = table.querySelector("thead tr");
    const tbody = table.querySelector("tbody");

    // Clear existing table headers and rows
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Determine headers based on sort type
    let headers = [];
    if (sortType === "country") {
        headers = ["Name", "Real Name", "Capital", "Region", "Population", "Languages", "Borders", "Timezones"];
    } else {
        headers = ["Region", "Countries", "Timezones"];
    }

    // Append headers to the table
    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        thead.appendChild(th);
    });

    // Sort and display data rows
    data.sort((a, b) => {
        let valA, valB;
        valA = a.value;
        valB = b.value;
        return valB - valA;  // Sort data in descending order based on value
    });

    // Populate table rows based on data
    data.forEach(d => {
        const row = document.createElement("tr");
        if (sortType === "country") {
            const borders = d.additionalInfo.borders.join(', ');  // Format borders as a comma-separated string
            const timezones = d.additionalInfo.timezones.join(', ');  // Format timezones similarly
            const languages = d.additionalInfo.languages.map(lang => `${lang.name} (${lang.nativeName})`).join(', ');  // Format languages
            row.innerHTML = `
                <td>${d.name}</td>
                <td>${d.additionalInfo.realName}</td>
                <td>${d.additionalInfo.capital}</td>
                <td>${d.additionalInfo.region}</td>
                <td>${d.additionalInfo.population}</td>
                <td>${languages}</td>
                <td>${borders}</td>
                <td>${timezones}</td>
            `;
        } else {
            row.innerHTML = `
                <td>${d.name}</td>
                <td>${d.additionalInfo['countries']}</td>
                <td>${d.additionalInfo['timezones']}</td>
            `;
        }
        tbody.appendChild(row);  // Append each row to the table body
    });
}