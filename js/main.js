//wrap everything in a self-executing anonymous function to move to local scope
(function(){

//variables for data join
var attrArray = ["total", "mag0", "mag1", "mag2", "mag3","mag4","mag5","inj","fat","loss","closs","len","wid","mobile","time"];

var expressed = attrArray[0]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection
    var projection = d3.geoAlbers()
        .center([5.45, 39.96])
        .rotate([93.73, 0.91, 0])
        .parallels([35.68, 45.50])
        .scale(980)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/tordata.csv") //load attributes from csv
        .defer(d3.csv, "data/sumstats.csv") //load attributes from stats csv
        .defer(d3.json, "data/states.topojson") //load background spatial data
        .defer(d3.json, "data/hexbins.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error,csvData,statsData,states,hexbins){
        //Translate the topojson
        var states_topo = topojson.feature(states, states.objects.collection);
        var hexbins_topo = topojson.feature(hexbins,hexbins.objects.collection).features;

        hexbins_topo = joinData(hexbins_topo, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //Generate map
        setEnumerationUnits(hexbins_topo, map, path, colorScale);
        setStateOverlay(states_topo, map, path);

        //add coordinated visualization to the map
        setChart(statsData);
        
    };
};

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
                    attrArray.forEach(function(attr){
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
        "#feedde",
        "#fdbe85",
        "#fd8d3c",
        "#e6550d",
        "#a63603"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

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

    return colorScale;
};

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
                return "bins " + d.properties.grid_id;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            });
};

//add states to map
function setStateOverlay(states_topo, map, path){
        var states = map.append("path")
            .datum(states_topo)
            .attr("class", "states")
            .attr("d", path);
};

//function to create coordinated bar chart
function setChart(csvData){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 560;


    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    var margin = {top: 20, right: 20, bottom: 30, left: 50},
    width = +chart.attr("width") - margin.left - margin.right,
    height = +chart.attr("height") - margin.top - margin.bottom,
    g = chart.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // set the ranges
    var x = d3.scaleLinear().range([0, chartWidth]);
    var y = d3.scaleLinear().range([chartHeight, 0]);

    // define the line
    var valueline = d3.line()
        .x(function(d) { return x(d.year); })
        .y(function(d) { return y(d.total); });
        console.log(d3.max(csvData, function(d) { return d.total; }));
    // Scale the range of the data
    x.domain([1950,2015]);
    y.domain([0, 1799]);

    // Add the valueline path.
    chart.append("path")
        .data([csvData])
        .attr("class", "line")
        .attr("d", valueline)
        .attr('stroke', 'green')
        .attr('stroke-width', 2)
        .attr('fill', 'none');

    g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))
    .select(".domain")
      .remove();

  g.append("g")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em");
};

})();