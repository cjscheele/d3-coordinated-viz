//wrap everything in a self-executing anonymous function to move to local scope
(function(){

//variables for data join
var attrArrayData = ["total", "mag0", "mag1", "mag2", "mag3","mag4","mag5","inj","fat"];
var attrArray = [["total","All"], ["mag0","EF0"],["mag1","EF1"], ["mag2","EF2"], ["mag3","EF3"],["mag4","EF4"],["mag5","EF5"],["inj","Injuries"],["fat","Fatalities"]];

var expressed = attrArray[0][0]; //initial attribute
var expressedDisp = attrArray[0][1];

//y-max cales for the chart
var scales = {'total':[1800,20],'mag0':[1250,20],'mag1':[650,20],'mag2':[350,10],'mag3':[100,10],'mag4':[40,10],'mag5':[10,10],'inj':[6850,1590],'fat':[600,160]}

//Used for holding the current csv data
var currStats;

//Chart, x and y
var x,y;

// define the line
var valueline;

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = $("#mapWindow").innerWidth(),
        height = 460;

    //create new svg container for the map
    var map = d3.select("#mapWindow")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection
    var projection = d3.geoAlbers()
        .center([-0.8, 39.96])
        .rotate([93.73, 0.91, 0])
        .parallels([35.68, 45.50])
        .scale(880)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/tordata.csv") //load attributes from csv
        .defer(d3.csv, "data/total.csv") //load attributes for stats csv
        .defer(d3.json, "data/states.topojson") //load background spatial data
        .defer(d3.json, "data/hexbins.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error,csvData,sumStatsData,states,hexbins){
        //Translate the topojson
        var states_topo = topojson.feature(states, states.objects.collection);
        var hexbins_topo = topojson.feature(hexbins,hexbins.objects.collection).features;
        
        //Join csv to hexbins
        hexbins_topo = joinData(hexbins_topo, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //Generate map
        setStateOverlay(states_topo, map, path);
        setEnumerationUnits(hexbins_topo, map, path, colorScale);
        
        //add coordinated visualization to the map
        currStats = sumStatsData;
        setChart(currStats,"total");

        //Add dropdown
        createDropdown(csvData,currStats);        
    };
};

//Join bins and csv
function joinData(hexbins_topo, csvData){
    //loop through csv to assign each set of csv attribute values to geojson bin
        for (var i=0; i<csvData.length; i++){
            var csvBin = csvData[i]; //the current bin
            var csvKey = csvBin.id; //the CSV primary key

            //loop through geojson regionsbins to find correct bin
            for (var a=0; a<hexbins_topo.length; a++){

                var geojsonProps = hexbins_topo[a].properties; //the current bin geojson properties
                var geojsonKey = geojsonProps.GRID_ID; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArrayData.forEach(function(attr){
                        if (attr == "time"){ //handle json object
                            var val = JSON.parse(JSON.stringify(csvBin[attr]));
                        }else{
                            var val = parseFloat(csvBin[attr]); //get csv attribute value
                        }
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
    return hexbins_topo;
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#fdd0a2",
        "#fdae6b",
        "#fd8d3c",
        "#e6550d",
        "#a63603"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses)

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    //create legend
    legend(colorScale);

    return colorScale;
};

//Make legend
function legend(colorScale){
	var svg = d3.select("svg");

	svg.append("g")
	 	.attr("class", "legend")
	  	.attr("transform", "translate(20,325)");

	var legend = d3.legendColor()
		.title(expressedDisp)
	    .labelFormat(d3.format("d"))
	    .labels(d3.legendHelpers.thresholdLabels)
	    .useClass(false)
	    .scale(colorScale)

	svg.select(".legend")
		.call(legend);
}

//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color
    if (typeof val == 'number' && !isNaN(val) && val > 0){
        return colorScale(val);
    } else {
        return "#FFFFFF";
    };
};

//add bins to the map
function setEnumerationUnits(hexbins_topo, map, path, colorScale){
        var bins = map.selectAll(".bins")
            .data(hexbins_topo)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "bins " + d.properties.GRID_ID;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties)
            })
            .on("mousemove", moveLabel);

        var desc = bins.append("desc")
            .text('{"stroke": "white", "stroke-width": "0.5px","stroke-opacity": "0.65"}');
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.GRID_ID)
        .style("stroke", "#000080")
        .style("stroke-width", "1")
        .style("stroke-opacity", "1");

    //call set label
    setLabel(props);
    changeChart(expressed,props.GRID_ID,1,selected.style('fill'));
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.GRID_ID)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    d3.select(".infolabel")
        .remove();

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
};

function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

//add states to map
function setStateOverlay(states_topo, map, path){
    var states = map.append("path")
        .datum(states_topo)
        .attr("class", "states")
        .attr("d", path);
};

//function to create coordinated bar chart
function setChart(csvData,attr){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.47,
        chartHeight = 460;

    var formatter = d3.format("");

    // set the dimensions and margins of the graph
	var margin = {top: 25, right: 20, bottom: 50, left: 70},
	    width = chartWidth - margin.left - margin.right,
	    height = chartHeight - margin.top - margin.bottom;

	var chart = d3.select("#panelWindow").append("svg")
	    .attr("width", width + margin.left + margin.right)
	    .attr("height", height + margin.top + margin.bottom)
	    .attr("class", "chart")
	    .append("g")
	    	.attr("transform",
	        "translate(" + margin.left + "," + margin.top + ")");

    // set the ranges
    x = d3.scaleLinear().range([0, width]);
    y = d3.scaleLinear().range([height, 0]);

    // define the line
    valueline = d3.line()
        .x(function(d) { return x(d.year); })
        .y(function(d) { return y(d.total); });

    // Scale the range of the data
    x.domain([1950,2015]);
    y.domain([0, scales[attr][0]]);

    // Add the value line path.
    chart.append("path")
        .data([csvData])
        .attr("class", "line")
        .attr("d", valueline)
        .attr('stroke', '#000080')
        .attr('stroke-width', 2)
        .attr('fill', 'none');

	// Add the x Axis
	chart.append("g")
		.attr("class", "xaxis")
	    .attr("transform", "translate(0," + height + ")")
	    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

	// text label for the x axis
	chart.append("text")             
	    .attr("transform",
	            "translate(" + (width/2) + " ," + 
	                (height + margin.top + 20) + ")")
	    .style("text-anchor", "middle")
	    .text("Year");

	// Add the y Axis
	chart.append("g")
		.attr("class", "yaxis")
	    .call(d3.axisLeft(y));

	// text label for the y axis
	chart.append("text")
	  	.attr("transform", "rotate(-90)")
	    .attr("y", 0 - margin.left)
	    .attr("x",0 - (height / 2))
	    .attr("dy", "1em")
	    .style("text-anchor", "middle")
	    .text("Count");  

	//Add title
	chart.append("text")
        .attr("id","chartTitle")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px")   
        .text(expressedDisp+" 1950-2015");

    //Add reset button
    var button = d3.select("#panelWindow")
        .append("input")
	        .attr("type","button")
	        .attr("value","Reset")
	        .attr("class", "button")
	        .attr("id","reset")
	        .on("click", function(){
	            resetChart();
	        });
};

//Reset the chart to totals
function resetChart(){
	changeChart(expressed,"total",0,'#000080');
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("#mapWindow")
        .append("select")
        .attr("class", "dropdown")
        .attr("id","attrDropdown")
        .on("change", function(){
            changeAttribute(this.value,$("#attrDropdown option[value='"+this.value+"']").text(),csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d[0] })
        .attr("name", function(d){ return d[1] })
        .text(function(d){ return d[1] });
};

//dropdown change listener handler
function changeAttribute(attr,name, csvData){
    //change the expressed attribute
    expressed = attr;
    expressedDisp = name;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var regions = d3.selectAll(".bins")
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
    //Load new stats data
    d3.csv("data/"+attr+".csv",function(data) {
        currStats = data;

        //update the chart
        changeChart(attr,'total',0,'#000080');
    });
};

function changeChart(attr,col,scale,color){
		// Scale the range of the data again 
	    x.domain([1950,2015]);
	    y.domain([0, scales[attr][scale]]);
	    
	    // Select the section we want to apply our changes to
	    var svg = d3.select(".chart").transition();

	    // define the line
		valueline = d3.line()
		    .x(function(d) { return x(d.year); })
		    .y(function(d) { return y(d[col]); });
	    // Make the changes
	    svg.select(".line")   // change the line
	        .duration(500)
	        .attr("d", valueline(currStats,col))
	        .attr('stroke', color);
	    svg.select(".yaxis") // change the y axis
	        .duration(500)
	        .call(d3.axisLeft(y));
        svg.select("#chartTitle") //change title
            .text(expressedDisp+" 1950-2015");    
}

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h3>" + props[expressed] + "</h3><b>total</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.GRID_ID + "_label")
        .html(labelAttribute);
};
})();