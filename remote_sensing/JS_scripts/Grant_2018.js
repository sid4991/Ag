////////////////////////////////////////////////////////////////////////
/////
/////     We can read a shapefile with many polygons, and using map()
/////     read all images corresponding to a polygon. However, the result of
/////     that is a featureCollection for which we do not know how to
/////     access to the info. inside. So, we want to do a for-loop for each polygon 
/////     now.
/////

//##
//##    GLOBAL Variables
//##
var grant_2018_regions = ee.FeatureCollection(grant_2018_SF);
// print ("Number of fields in the shapefile is", grant_2018_regions.size());

var start_date = '2018-01-01';
var end_date = '2018-12-31';
    
// print(grant_2018_regions);

////////////////////////////////////////////////////////////////////////////////////////
///
///                           functions definitions start
///
/// Function to mask clouds using the Sentinel-2 QA band.
function maskS2clouds(image) {
    var qa = image.select('QA60');

    // Bits 10 and 11 are clouds and cirrus, respectively.
    var cloudBitMask = 1 << 10;
    var cirrusBitMask = 1 << 11;

    // Both flags should be set to zero, indicating clear conditions.
    var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
                        qa.bitwiseAnd(cirrusBitMask).eq(0));

    // Return the masked and scaled data, without the QA bands.
    return image.updateMask(mask).divide(10000)
                          .select("B.*")
                          .copyProperties(image, ["system:time_start"]);
}

////////////////////////////////////////////////
///
/// add Day of Year to an image
///

function addDate_to_image(image){
  var doy = image.date().getRelative('day', 'year');
  var doyBand = ee.Image.constant(doy).uint16().rename('doy');
  doyBand = doyBand.updateMask(image.select('B8').mask());

  return image.addBands(doyBand);
}

////////////////////////
///
/// add Day of Year to an imageCollection
///

function addDate_to_collection(collec){
  var C = collec.map(addDate_to_image);
  return C;
}

////////////////////////////////////////////////
///
///
/// add NDVI to an image

function addNDVI_to_image(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

////////////////////////////////////////////////
///
///
/// add NDVI to an imageCollection

function add_NDVI_collection(image_IC){
  var NDVI_IC = image_IC.map(addNDVI_to_image);
  return NDVI_IC;
}

////////////////////////////////////////////////
///
///
/// Extract ImageCollection from Sentinel 2- level 1C 
/// dates etc are hard-coded to enable us to use map() function

function extract_sentinel_IC(a_feature){
    // var cloud_percentage = 
    // var geom = ee.Feature(feature_col).geometry();
    var geom = a_feature.geometry();
    var newDict = {'original_polygon_1': geom};
    var imageC = ee.ImageCollection('COPERNICUS/S2')
                .filterDate(start_date, end_date)
                .filterBounds(geom)
                //.filterMetadata('CLOUDY_PIXEL_PERCENTAGE', "less_than", 10)
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
                .sort('system:time_start', true);
    
    // toss out cloudy pixels
    imageC = imageC.map(maskS2clouds);
    
    // pick up some bands
    imageC = imageC.select(['B8', 'B4', 'B3', 'B2']);
    
    // add DoY as a band
    imageC = addDate_to_collection(imageC);
    
    // add NDVI as a band
    imageC = add_NDVI_collection(imageC);
    
    // add original geometry to each image
    // we do not need to do this really:
    imageC = imageC.map(function(im){return(im.set(newDict))});
    
    // add original geometry and WSDA data as a feature to the collection
    imageC = imageC.set({ 'original_polygon': geom,
                          'WSDA':a_feature
                        });
    // imageC = imageC.sort('system:time_start', true);

    //imageC = imageC.map(add_NDVI_collection)
  return imageC;
}

function mosaic_and_reduce_IC_mean(an_IC){
  an_IC = ee.ImageCollection(an_IC);
  
  var reduction_geometry = ee.Feature(ee.Geometry(an_IC.get('original_polygon')));
  var WSDA = an_IC.get('WSDA');
  var start_date_DateType = ee.Date(start_date);
  var end_date_DateType = ee.Date(end_date);
  //######**************************************
  // Difference in days between start and end_date

  var diff = end_date_DateType.difference(start_date_DateType, 'day');

  // Make a list of all dates
  var range = ee.List.sequence(0, diff.subtract(1)).map(function(day){
                                    return start_date_DateType.advance(day,'day')});

  // Funtion for iteraton over the range of dates
  function day_mosaics(date, newlist) {
    // Cast
    date = ee.Date(date);
    newlist = ee.List(newlist);

    // Filter an_IC between date and the next day
    var filtered = an_IC.filterDate(date, date.advance(1, 'day'));

    // Make the mosaic
    var image = ee.Image(filtered.mosaic());

    // Add the mosaic to a list only if the an_IC has images
    return ee.List(ee.Algorithms.If(filtered.size(), newlist.add(image), newlist));
  }

  // Iterate over the range to make a new list, and then cast the list to an imagecollection
  var newcol = ee.ImageCollection(ee.List(range.iterate(day_mosaics, ee.List([]))));
  //print("newcol 1", newcol);
  //######**************************************

  var reduced = newcol.map(function(image){
                            return image.reduceRegions({
                                                        collection:reduction_geometry,
                                                        reducer:ee.Reducer.mean(), 
                                                        scale: 10
                                                      });
                                          }
                        ).flatten();
                          
  reduced = reduced.set({ 'original_polygon': reduction_geometry,
                        'WSDA':WSDA
                      });
  WSDA = ee.Feature(WSDA);
  WSDA = WSDA.toDictionary();
  
  // var newDict = {'WSDA':WSDA};
  reduced = reduced.map(function(im){return(im.set(WSDA))}); 
  return(reduced);
}

///
///                         functions definitions end
///
////////////////////////////////////////////////////////////////////////////////////////

var Grant_2018_IC = grant_2018_regions.map(extract_sentinel_IC);

// var Grant_2018_IC_first = ee.ImageCollection(Grant_2018_IC.first());
// print("1", Grant_2018_IC.first());

// var an_imggg = Grant_2018_IC_first.first();
// print("2", an_imggg);

// var Grant_2018_IC_first_reduced = mosaic_and_reduce_IC_mean(Grant_2018_IC_first);
// print ("3", Grant_2018_IC_first_reduced);

var all_fields_TS = Grant_2018_IC.map(mosaic_and_reduce_IC_mean);

Export.table.toDrive({
  collection: all_fields_TS.flatten(),
  description:'Grant_2018_TS',
  folder:"Grant_2018",
  fileFormat: 'CSV'
});

// Export.table.toDrive({
//   collection:all_fields_TS.flatten(),
//   description:'Grant_2018_TS',
//   folder:"Grant_2018",
//   fileFormat: 'SHP'
// });



//#############################################################
//
//           Plot Charts on the right panel (Console)
//
//#############################################################

// var first_region = grant_2018_regions.first();
// var first_NDVI_TS = ui.Chart.image.doySeriesByYear({
//                             imageCollection: Grant_2018_IC_first, 
//                             bandName: 'NDVI', 
//                             region: first_region.geometry(), 
//                             regionReducer: ee.Reducer.mean() 
//                             // scale: plot_scale
//                               });

// print(first_NDVI_TS);

//#############################################################
//
//                        Plot the Map below
//
//#############################################################

// Map.setCenter(-119.525, 47.525995, 16);
// // Map.addLayer(first_region.geometry())
// Map.addLayer(first_region.geometry(), 
//             {color: 'FF0000'}, 
//             'The farm is plotted in red');

