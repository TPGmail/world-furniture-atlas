/* Furniverse: antimeridian-safe polygon geometry.
 * D3 geoPath's built-in antimeridian clipping creates separate closed rings
 * at +/-180 degrees, avoiding horizontal lines across the Leaflet world map.
 * The source geometry and canonical country identifiers are never mutated. */
(function (root) {
  'use strict';

  function ringsOf(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return geometry.coordinates;
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
    return [];
  }
  function jumpsAcrossDateline(feature) {
    return ringsOf(feature && feature.geometry).some(ring => ring.some((point,index) =>
      index > 0 && Math.abs(Number(point[0]) - Number(ring[index-1][0])) > 180));
  }
  function ringIsSafe(ring) {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    for (let i = 0; i < ring.length; i++) {
      const [lon,lat] = ring[i];
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180.01 || lon > 180.01 ||
          lat < -90.01 || lat > 90.01) return false;
      if (i && Math.abs(ring[i-1][0]-lon) > 180.001) return false;
    }
    return true;
  }
  // For rare clipping inputs with an unbalanced winding, unwrapping guarantees
  // a short adjacent segment. Longitudes outside +/-180 are valid in Leaflet.
  function unwrapRing(ring) {
    const output = [];
    for (const [rawLon,lat] of ring) {
      let lon = rawLon;
      if(output.length) {
        const prev = output[output.length-1][0];
        while(lon-prev>180) lon-=360;
        while(lon-prev< -180) lon+=360;
      }
      output.push([lon,lat]);
    }
    // A ring clipped at the dateline should return to its starting coordinate.
    if (output.length && Math.abs(output.at(-1)[0]-output[0][0]) < .001 &&
        Math.abs(output.at(-1)[1]-output[0][1]) < .001) {
      output[output.length-1] = output[0].slice();
    }
    return output;
  }
  function fix(feature,d3) {
    if (!feature || !feature.geometry || !jumpsAcrossDateline(feature)) return feature;
    if (!d3 || typeof d3.geoPath !== 'function' || typeof d3.geoEquirectangular !== 'function') {
      return feature; // Do not fabricate shapes when the clipping dependency is unavailable.
    }
    const contours = [];
    let current = null;
    const ctx = {
      beginPath() {},
      moveTo(x,y) {current = [[x,-y]];contours.push(current);},
      lineTo(x,y) {if(current) current.push([x,-y]);},
      closePath() {
        if(current && current.length >= 3) {
          const first=current[0], last=current.at(-1);
          if(Math.abs(first[0]-last[0])>1e-8 || Math.abs(first[1]-last[1])>1e-8)
            current.push(first.slice());
        }
        current = null;
      },
      arc() {}
    };
    const projection = d3.geoEquirectangular().scale(180/Math.PI).translate([0,0]).precision(0);
    try { d3.geoPath(projection,ctx)(feature); }
    catch (error) { console.warn('Could not clip antimeridian:',String(feature.id),error); return feature; }
    const usable = contours.filter(ring => ring.length >= 4 && ring.every(pt => pt.every(Number.isFinite)));
    if (!usable.length) return feature;
    const allSafe = usable.every(ringIsSafe);
    const cleaned = allSafe ? usable : usable.map(unwrapRing);
    // D3 has already split the geographic polygon at the seam into bounded contours.
    // Treat each clipped contour as a separate polygon so Leaflet never connects the
    // two antimeridian sides with a world-spanning straight line.
    return {
      ...feature,
      geometry: {type:'MultiPolygon',coordinates:cleaned.map(ring => [ring])},
      properties: {...feature.properties}
    };
  }
  root.FurniverseDateLine = Object.freeze({fix,jumpsAcrossDateline,ringIsSafe});
})(window);
