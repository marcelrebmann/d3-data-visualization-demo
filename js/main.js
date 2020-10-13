const DEPARTMENTS = {
    PRODUCTION: "Production",
    LOGISTICS: "Logistics",
    IT: "IT",
    MARKETING: "Marketing",
    OTHER: "Other"
};

const ERROR_LOADING_DATA_FAILED = "Loading data failed!";
const ERROR_NO_DATA_AVAILABLE = "No data available!";

// The margin within the bar chart svg.
const margin = {
    top: 60,
    right: 20,
    bottom: 40,
    left: 60
};
// The width and height of the tooltip in px.
const tooltipWidthPx = 200;
const tooltipHeightPx = 50;

// The viewoport breakpoints
const BREAKPOINTS = {
    small: 650,
    mobile: 380
};

// The loading overlay container
const loadingOverlayContainer = document.getElementById("loading-overlay");

// The element that displays the error message, if an error occurs.
const errorMessageElement = document.getElementById("error-message");

// The div element containing the bar chart.
const barChartContainer = document.getElementById("bar-chart-container");

// The bar chart svg element.
let barChart;

// The data "loaded" from the server.
let companyData;

// The highest student count of all semesters in the data.
let maxEmployees = 0;

// The current user-selected bar (svg rect) element.
let selectedBar;

// The doughnut chart svg element.
let donutChart;

// Tooltip related elements.
let tooltipContainerElement;
let tooltipContentElement;
let tooltipMarkerElement;

function loadData() {
    return new Promise((resolve, reject) => {
        $.getJSON("data/employee_data.json")
            .done((data) => {
                setTimeout(() => {
                    // If the request succeeded, but the data object is undefined or has no entries, show an error.
                    if (!data || !data.length) {
                        return reject(ERROR_NO_DATA_AVAILABLE);
                    }
                    resolve(data);
                }, Math.random() * 2000 + 1000);
            })
            .fail(() => {
                // If the request fails, show an error message to the user.
                reject(ERROR_LOADING_DATA_FAILED);
            });
    });
}

/**
 * Maps a department's name to the specific color variable (defined in the stylesheet).
 * If the given name does not match, gray is returned by default.
 * This is mainly used to enable the smooth animation of the donut chart slices via interpolation.
 * @param departmentName
 * @returns {string}
 */
function getDepartmentColor(departmentName) {
    switch (departmentName) {
        case DEPARTMENTS.PRODUCTION:
            return "var(--color-chart-production)";
        case DEPARTMENTS.LOGISTICS:
            return "var(--color-chart-logistics)";
        case DEPARTMENTS.IT:
            return "var(--color-chart-it)";
        case DEPARTMENTS.MARKETING:
            return "var(--color-chart-marketing)";
        case DEPARTMENTS.OTHER:
            return "var(--color-chart-other)";
        default:
            return "var(--color-primary-black-darker)";
    }
}

/**
 * Calculates the tooltip and tooltip-marker positions.
 * The tooltip position is the x-offset relative to the bar chart container's width.
 */
function calculateTooltipPosition(anchorElement, containerWidth) {
    // Get the positions of the selected bar and the bar chart itself.
    const anchorPosition = anchorElement.getBoundingClientRect();
    const barChartPosition = barChartContainer.getBoundingClientRect();

    const leftOffset = barChartPosition.left;
    const barChartWidth = barChartPosition.width;

    // The position of the center of the selected bar element within the bar chart svg.
    const anchorCenter = (anchorPosition.left - leftOffset) + (anchorPosition.width / 2);

    const leftBoundary = 0;
    const rightBoundary = (barChartWidth - containerWidth) / barChartWidth * 100;
    // The tooltip's relative left offset (in %) within the bar chart element.
    const xPosition = (anchorCenter - (containerWidth / 2)) / barChartWidth * 100;
    // The tooltip marker line's relative left offset within the bar chart element.
    const markerPositionX = anchorCenter / barChartWidth * 100;

    const tooltipPositions = {
        container: {
            x: xPosition
        },
        marker: {
            x: markerPositionX,
            // The height of the marker (from the bottom of the tooltip content to the top of the bar element).
            height: anchorPosition.top - barChartPosition.top - tooltipHeightPx
        }
    };

    // If the tooltip would exceed the bar chart container to the left or right, adjust it to the left or right end.
    if (xPosition > rightBoundary) {
        tooltipPositions.container.x = rightBoundary;
    } else if (xPosition < leftBoundary) {
        tooltipPositions.container.x = leftBoundary;
    }
    return tooltipPositions;
}

// Generates the tooltip's content as Html using a specific data entry.
function generateTooltipContentHtml(dataEntry) {
    return `<span>${dataEntry.quarter}</span>
            <div>
                <div class="user-logo"></div>
                <span>${dataEntry.employees}</span>
            </div>`;
}

/**
 * Updates the values of the employee count in the detail table.
 * @param valueProduction amount of Production employees in the selected quarter.
 * @param valueLogistics amount of Logistics employees in the selected quarter.
 * @param valueIT amount of IT employees in the selected quarter.
 * @param valueMarketing amount of Marketing employees in the selected quarter.
 * @param valueOther amount of other employees in the selected quarter.
 */
function updateTableValues(valueProduction, valueLogistics, valueIT, valueMarketing, valueOther) {
    document.getElementById("value-production").innerText = valueProduction;
    document.getElementById("value-logistics").innerText = valueLogistics;
    document.getElementById("value-it").innerText = valueIT;
    document.getElementById("value-marketing").innerText = valueMarketing;
    document.getElementById("value-other").innerText = valueOther;
}

/**
 * Updates the bar chart tooltip's position. Usually the case, if a new quarter is selected
 * or the browser window is resized by the user.
 * @param domRect The selected bar (svg rect) element.
 */
function updateTooltipPosition(domRect) {
    const tooltipPosition = calculateTooltipPosition(domRect, tooltipWidthPx);

    tooltipContainerElement
        .style("left", `${tooltipPosition.container.x}%`);

    tooltipMarkerElement
        .style("left", `${tooltipPosition.marker.x}%`)
        .style("height", `${tooltipPosition.marker.height}px`);
}

/**
 * Updates the tooltip completely. This includes rendering the content and calculating the position.
 * @param dataEntry The data of the selected quarter
 * @param domRect The selected bar (svg rect) element.
 */
function updateTooltip(dataEntry, domRect) {

    tooltipMarkerElement
        .style("top", `${tooltipHeightPx}px`);

    updateTooltipPosition(domRect);
    tooltipContentElement.html(generateTooltipContentHtml(dataEntry));

    tooltipContainerElement
        .style("opacity", 0.9);
}

/**
 * Removes the placeholder for the detailed information.
 */
function removePlaceholder() {
    document.getElementById("placeholder").remove();
}

/**
 * This function thins out several ticks of the bar chart's x axis if the browser window
 * is too small to display all labels properly.
 * On small windows, every 2nd tick is removed.
 * On mobile size windows, only every 4th tick is visible.
 */
function thinOutBarChartTicksX() {
    const windowWidthPx = window.innerWidth;
    const isMobileMode = windowWidthPx <= BREAKPOINTS.mobile;
    const isSmallWindowMode = windowWidthPx <= BREAKPOINTS.small && !isMobileMode;

    if (isSmallWindowMode) {
        barChart.select("g.axis.x")
            .selectAll("g.tick:nth-child(2n)")
            .remove();
    }

    if (isMobileMode) {
        barChart.select("g.axis.x")
            .selectAll("g.tick:not(:nth-child(4n))")
            .remove();
    }
}

/**
 * Returns the x axis scale for the bar chart. This is a scale band.
 * @returns {*|Function|number|never}
 */
function xScale() {
    return d3.scaleBand()
        .domain(companyData.map(d => d.quarter))
        .range([margin.left, barChartContainer.clientWidth - margin.right])
        .padding(0.1)
}

/**
 * Returns the y axis scale for the bar chart. This is a linear scale.
 * @returns {Array|*|...*[]}
 */
function yScale() {
    return d3.scaleLinear()
        .domain([0, maxEmployees])
        .nice()
        .range([barChartContainer.clientHeight - margin.bottom, margin.top]);
}

/**
 * Takes a svg group element and renders the bar chart's x axis into it.
 * The axis tick is rendered for every Wintersemester entry in the data.
 * @param g The svg group element where the axis should be rendered into.
 */
function xAxis(g) {
    g.attr("transform", `translate(0,${barChartContainer.clientHeight - margin.bottom})`)
        .call(
            d3.axisBottom(xScale())
                .tickValues(xScale().domain().filter((d, i) => i % 2))
                .tickSizeOuter(0)   // Hide the ticks at the very beginning and end of the axis.
        );
}

/**
 * Takes a svg group element and renders the bar chart's y axis into it.
 * @param g The svg group element where the axis should be rendered into.
 */
function yAxis(g) {
    g.attr("transform", `translate(${margin.left},0)`)
        .call(
            d3.axisLeft(yScale())
                .ticks(5)
                .tickFormat(t => (t > 1000 ? `${t / 1000}k` : t))
        );
}

/**
 * Handles displaying the detailed data of a quarter on user selection.
 * @param dataEntry
 * @param index
 * @param domRects
 */
function showDetailsOnSelection(dataEntry, index, domRects) {
    const clickedBarElement = domRects[index];
    const departments = dataEntry.departments || [];

    if (typeof selectedBar !== "undefined") {
        d3.select(selectedBar).attr("class", "bar");
    }
    selectedBar = clickedBarElement;
    d3.select(clickedBarElement)
        .attr("class", "bar selected");
    updateTooltip(dataEntry, clickedBarElement);
    updateTableValues(...departments.map(department => department.count));

    if (!donutChart) {
        removePlaceholder();
        generateDonutChart(departments, dataEntry.quarter);
        document.getElementById("employee-details-table").style.display = "block";
        document.getElementById("donut-chart-container").style.display = "block";
    } else {
        updateDonutChart(departments, dataEntry.quarter);
    }
}

/**
 * Generator function to create the bar chart.
 * @param data the loaded data
 */
function generateBarChart(data) {
    const containerWidth = barChartContainer.clientWidth;
    const containerHeight = barChartContainer.clientHeight;

    const x = xScale();
    const y = yScale();

    tooltipContainerElement = d3.select("#bar-chart-container")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    tooltipContentElement = tooltipContainerElement
        .append("div")
        .attr("class", "tooltip-content");

    tooltipMarkerElement = d3.select("#bar-chart-container")
        .append("div")
        .attr("class", "tooltip-marker-line");

    // Create the bar chart svg element.
    barChart = d3.create("svg")
        .attr("height", containerHeight)
        .attr("width", "100%");

    barChart.append("g")                            // Add a container for the bars / the chart's displayed data
        .attr("class", "main")                      // Add the .main css class to the group element
        .selectAll("rect")                          // Select all rects
        .data(data)                                 // Map data to rects
        .join("rect")                               // Append new rects for the data (if necessary, remove existing ones)
        .attr("class", "bar")                       // For each rect add the .bar css class to the rect
        .attr("x", d => x(d.quarter))               // ...and get the x position using the x scale
        .attr("y", d => y(d.employees))             // ...and get the y position using the y scale
        .attr("height", d => y(0) - y(d.employees)) // ...and calculate the bar's height
        .attr("width", x.bandwidth())               // ...and calculate the bar's width
        .on("click", showDetailsOnSelection);       // ...and if the rect is clicked, show the details

    // Add the x axis
    barChart.append("g")
        .attr("class", "axis x")
        .call(xAxis);

    // Remove some of the axis ticks, if necessary.
    thinOutBarChartTicksX();

    // Add the text label for the x axis
    barChart.append("text")
        .attr("class", "axis-label x")
        .attr("transform", `translate(${margin.left + ((containerWidth - margin.left) / 2)},${containerHeight - margin.bottom})`)
        .attr("dy", "2.5em")
        .style("text-anchor", "middle")
        .text("Quarter");

    // Add the y axis
    barChart.append("g")
        .attr("class", "axis y")
        .call(yAxis);

    // Add the text label for the Y axis
    barChart.append("text")
        .attr("class", "axis-label y")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x", 0 - (margin.top + ((containerHeight - margin.top - margin.bottom) / 2)))
        .attr("dy", "1.5em")
        .style("text-anchor", "middle")
        .text("Employees");

    barChartContainer.appendChild(barChart.node());
}

/**
 * Hides the loader gif.
 */
function hideLoader() {
    // As the "main" tag is always present in the html, we can omit a null-check here.
    document.body.getElementsByTagName("main")[0].removeChild(loadingOverlayContainer);
}

function showError(error) {
    loadingOverlayContainer.getElementsByTagName("img")[0].remove();
    errorMessageElement.innerText = error;
    errorMessageElement.style.display = "block";
}

/**
 * Function to update the bar chart, if the user changes the dimensions of the browser window.
 */
function redrawBarChart() {
    // Get the new window dimensions.
    const newWidth = barChartContainer.clientWidth;
    const newHeight = barChartContainer.clientHeight;

    // Get the updated scales with the new ranges.
    const updatedXScale = xScale();
    const updatedYScale = yScale();

    // Set the new width and height to the bar chart svg.
    barChart.attr("width", newWidth)
        .attr("height", newHeight);

    // Update the y Axis.
    barChart.select("g.axis.y")
        .call(yAxis);

    // Update the x Axis.
    barChart.select("g.axis.x")
        .call(xAxis);

    // Remove some of the x axis ticks, if necessary.
    thinOutBarChartTicksX();

    // Update the rendered bars.
    barChart.select("g.main")
        .selectAll("rect")
        .attr("x", d => updatedXScale(d.quarter))
        .attr("y", d => updatedYScale(d.employees))
        .attr("height", d => updatedYScale(0) - updatedYScale(d.employees))
        .attr("width", updatedXScale.bandwidth());

    // Update the x axis label position
    barChart.select("text.axis-label.x")
        .attr("transform", `translate(${(margin.left + ((newWidth - margin.left)) / 2)},${newHeight - margin.bottom})`);

    // Update the y axis label position
    barChart.select("text.axis-label.y")
        .attr("x", 0 - (margin.top + ((newHeight - margin.top - margin.bottom) / 2)));

    if (!selectedBar) {
        return;
    }
    // If a bar is selected (the tooltip is visible), update the tooltip position.
    updateTooltipPosition(selectedBar);
}

const pieScale = d3.pie()                     // A pie scale
    .value((department) => department.count)  // the value is always the employee count
    .sort(null)                               // Sort by default
    .padAngle(0);                             // No padding between the slices.

const arc = d3.arc()                          // An arc
    .innerRadius(85)                          // The inner radius of the donut chart
    .outerRadius(130);                        // The outer radius of the donut chart

/**
 * Function to interpolate the old and new positions/dimensions of the slices.
 * For a detailed example how to use, see https://bl.ocks.org/tezzutezzu/c2653d42ffb4ecc01ffe2d6c97b2ee5e
 */
function arcTween(a) {
    const i = d3.interpolate(this._current, a);
    this._current = i(0);
    return function (t) {
        return arc(i(t));
    };
}

/**
 * Generator function to create the donut chart.
 * @param data The loaded data
 * @param quarterName The name of the selected quarter
 */
function generateDonutChart(data, quarterName) {
    donutChart = d3.create("svg")
        .attr("viewBox", "0 0 300 300")
        .attr("preserveAspectRatio", "xMidYMid meet");

    donutChart.append("g")
        .attr("class", "slices")
        .attr("transform", "translate(" + 300 / 2 + "," + 300 / 2 + ")")
        .selectAll("path")
        .data(pieScale(data))
        .enter()
        .append("path")
        .attr("class", "slice")
        .attr("fill", (d) => getDepartmentColor(d.data.name))
        .attr("d", arc);

    donutChart
        .select("g.slices")
        .selectAll("path.slice")
        .transition()
        .duration(300)
        .attrTween("d", arcTween);

    // Create the label inside the donut that shows the quarter name.
    donutChart.append("text")
        .attr("x", 150)
        .attr("y", 130)
        .selectAll("tspan")
        .data(quarterName.split(" "))
        .enter()
        .append("tspan")
        .attr("dy", "20px")
        .attr("x", 150)
        .attr("text-anchor", "middle")
        .text(d => d);

    document.getElementById("donut-chart-container").appendChild(donutChart.node());
}

/**
 * Updates the donut chart data.
 * The change is animated.
 * @param data the selected data entry
 * @param quarterName The name of the selected quarter
 */
function updateDonutChart(data, quarterName) {

    // Update the label with the new quarter name.
    donutChart.selectAll("tspan")
        .data(quarterName.split(" "))
        .join("tspan")
        .text(d => d);

    // Join the new data with the slices
    const arcs = donutChart
        .select("g.slices")
        .selectAll("path.slice")
        .data(pieScale(data), (d) => d.data.name.toLowerCase());

    // Interpolate the new positions
    arcs
        .transition()
        .duration(300)
        .attrTween("d", arcTween);

    // enter
    arcs.enter()
        .append("path")
        .attr("class", "slice")
        .attr("fill", d => getDepartmentColor(d.data.name))
        .attr("d", arc)
        .each(function (d) {
            this._current = d;
        });
}

window.addEventListener("resize", () => redrawBarChart());

loadData()
    .then((data) => {
        // This logic is only executed, if the loaded data is not empty (and defined of course).
        companyData = data;
        maxEmployees = d3.max(data.map(entry => entry.employees));
        generateBarChart(data);
    })
    .then(() => hideLoader())
    .catch((error) => showError(error));
