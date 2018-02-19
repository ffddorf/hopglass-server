/*  Copyright (C) 2018 Linus Broich

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. */

'use strict'

var async = require('async')
var fs = require('fs')
var gju = require('geojson-utils');
var _ = require('lodash')

//start with empty geojson shape file
var geojsonData = {}

module.exports = function(receiver, config) {
  
  function getZipCode(point, features) {
    var zipcode = null
    async.forEachOf(features, function(f, finished) {
      var result = false
      if (f.geometry.type == 'Polygon') 
        result = gju.pointInPolygon(point, f.geometry)
      else if (f.geometry.type == 'MultiPolygon')
        result = gju.pointInMultiPolygon(point, f.geometry)
      if (result)
        zipcode = f.properties.plz
        return
    })
    return zipcode
  }

  //zipfilter.json (Used for tunneldigger zipfilter)
  function getZipFilter(stream, query) {
    var data = receiver.getData(query)
    var zipfilter = {}
    async.forEachOf(data, function(n, k, finished) {
      zipfilter[k] = {}
      zipfilter[k].hostname = _.get(n, 'nodeinfo.hostname')
      zipfilter[k].site_code = _.get(n, 'nodeinfo.system.site_code')
      if (_.has(n, 'nodeinfo.software.firmware.release')) {
        zipfilter[k].release = _.get(n, 'nodeinfo.software.firmware.release')
      }
      if (_.has(n, 'nodeinfo.software.autoupdater.branch')) {
        zipfilter[k].branch = _.get(n, 'nodeinfo.software.autoupdater.branch')
      }
      if (_.has(n, 'nodeinfo.location.latitude') && _.has(n, 'nodeinfo.location.longitude')) {
        var point = { 'type': 'Point', 'coordinates': [_.get(n, 'nodeinfo.location.longitude'), _.get(n, 'nodeinfo.location.latitude')] }
        zipfilter[k].zipcode = getZipCode(point, geojsonData.features)
      } else {
        zipfilter[k].zipcode = null
      }
      finished()
    }, function() {
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      stream.end(JSON.stringify(zipfilter))
    })
  }
  
  console.log('Loading geojson shape file for zipfilter provider')
  try {
    var geojsonFile = JSON.parse(fs.readFileSync(config.geojsonFile, 'utf8'))
    geojsonData = geojsonFile
    console.info('successfully parsed geojson file "' + config.geojsonFile + '"')
  } catch (err) {
    console.warn('geojson file "' + config.geojsonFile + '" doesn\'t exist, using defaults')
  }

  return {
    /* eslint-disable quotes */
    "zipfilter.json": getZipFilter
  }
}
