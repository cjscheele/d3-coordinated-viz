//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //use d3.queue to parallelize asynchronous data loading
    
};

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 960,
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
        .defer(d3.json, "data/states.topojson") //load background spatial data
        .defer(d3.json, "data/hexbins.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error,csvData,states,hexbins){
        //Translate the topojson
        var states_topo = topojson.feature(states, states.objects.collection);
        var hexbins_topo = topojson.feature(hexbins,hexbins.objects.collection).features;

        //add bins to the map
        var bins = map.selectAll(".bins")
            .data(hexbins_topo)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "bins " + d.properties.grid_id;
            })
            .attr("d", path);

        //add states to map
        var states = map.append("path")
            .datum(states_topo)
            .attr("class", "states")
            .attr("d", path);
    };
};