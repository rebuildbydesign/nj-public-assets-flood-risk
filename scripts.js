mapboxgl.accessToken = 'pk.eyJ1IjoiajAwYnkiLCJhIjoiY2x1bHUzbXZnMGhuczJxcG83YXY4czJ3ayJ9.S5PZpU9VDwLMjoX_0x5FDQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/j00by/cml8tkndp003e01qofxow4fbd',
  center: [-74.1724, 40.7357], // Newark default
  zoom: 12
});

let activeYear = "2025";
let activeCity = "NEWARK CITY";
let popup = null;

const cityCenters = {
  "NEWARK CITY": [-74.1724, 40.7357],
  "ELIZABETH CITY": [-74.2107, 40.6639],
  "CAMDEN CITY": [-75.1196, 39.9259],
  "TRENTON CITY": [-74.7631, 40.2171],
  "JERSEY CITY": [-74.0776, 40.7282],
  "PATERSON CITY": [-74.1718, 40.9168],
  "ASBURY PARK CITY": [-74.0121, 40.2204],
  "ATLANTIC CITY": [-74.4229, 39.3643]
};

const colors = {
  AIRPORT: "#111111",        // deep charcoal black
  HOSPITAL: "#D7263D",       // bold crimson red
  KCS: "#FF8700",            // vivid orange
  LIBRARY: "#FFD100",        // strong gold/yellow
  PARK: "#3FB950",           // accessible green (GitHub green)
  POWERPLANT: "#8C1EFF",     // vibrant purple
  SCHOOL: "#FF5EBF",         // neon pink
  SOLIDHAZARD: "#A15500",    // rich brown/orange (hazard tone)
  SOLIDWASTE: "#FF3D00",     // intense red-orange
  SUPERFUND: "#C10087",      // deep magenta
  WASTEWATER: "#5A5A5A"      // slate gray (distinguishable from flood blue)
};

function loadLayers() {
  const floodId = `floodplain_${activeYear}`;
  const assetId = `assets_${activeYear}`;

  ["floodplain_2025", "floodplain_2050", "assets_2025", "assets_2050"].forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  });

  map.setLayoutProperty(floodId, 'visibility', 'visible');
  map.setLayoutProperty(assetId, 'visibility', 'visible');
  map.setFilter(assetId, ['==', ['get', 'MUN'], activeCity]);

  // Wait until layers finish rendering before updating the legend
  map.once('idle', () => updateLegend(assetId));
}

function updateLegend(assetId) {
  const legend = document.getElementById('legend');
  if (!legend) return;
  legend.innerHTML = '<h3>Legend</h3>';

  const layer = map.getLayer(assetId);
  if (!layer) return;

  const sourceId = layer.source;
  const features = map.querySourceFeatures(sourceId, {
    filter: ['==', ['get', 'MUN'], activeCity]
  });

  const seen = new Set();
  features.forEach(f => {
    const type = f.properties.ASSET;
    if (!seen.has(type)) {
      seen.add(type);
      const color = colors[type] || '#999';
      const div = document.createElement('div');
      div.className = 'legend-item';
      div.innerHTML = `<span class='legend-color' style='background-color:${color}'></span>${type}`;
      legend.appendChild(div);
    }
  });
}

map.on('load', () => {
  map.addSource('boundary', {
    type: 'geojson',
    data: 'data/boundary.geojson'
  });

map.addLayer({
  id: 'boundary',
  type: 'line',
  source: 'boundary',
  paint: {
    'line-color': 'rgba(255, 0, 0, 0.6)', // red with 60% opacity
    'line-width': 3,
    'line-dasharray': [2, 2]
  }
});


  ['2025', '2050'].forEach(year => {
    map.addSource(`floodplain_${year}`, {
      type: 'geojson',
      data: `data/floodplain_${year}.geojson`
    });

    map.addLayer({
      id: `floodplain_${year}`,
      type: 'fill',
      source: `floodplain_${year}`,
      paint: {
        'fill-color': 'rgba(0, 183, 255, 0.3)',
      },
      layout: { visibility: year === '2025' ? 'visible' : 'none' }
    });

    map.addSource(`assets_${year}`, {
      type: 'geojson',
      data: `data/assets_${year}.geojson`
    });

    map.addLayer({
      id: `assets_${year}`,
      type: 'circle',
      source: `assets_${year}`,
      paint: {
        'circle-radius': 6,
        'circle-color': ["match", ["get", "ASSET"],
          ...Object.entries(colors).flat(),
          "#cccccc"
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      },
      layout: { visibility: year === '2025' ? 'visible' : 'none' },
      filter: ['==', ['get', 'MUN'], activeCity]
    });
  });

  map.on('mousemove', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: [`assets_${activeYear}`]
    });

    map.getCanvas().style.cursor = features.length ? 'pointer' : '';

    if (popup) {
      popup.remove();
      popup = null;
    }

    if (features.length) {
      const f = features[0];
      const coords = f.geometry.coordinates.slice();
      popup = new mapboxgl.Popup({ closeButton: false })
        .setLngLat(coords)
        .setHTML(`<strong>${f.properties.NAME}</strong>`)
        .addTo(map);
    }
  });

  map.on('mouseleave', 'assets_2025', () => { if (popup) popup.remove(); });
  map.on('mouseleave', 'assets_2050', () => { if (popup) popup.remove(); });

  // Municipality buttons
  document.getElementById('municipality-select').addEventListener('change', (e) => {
  const selectedCity = e.target.value;
  if (cityCenters[selectedCity]) {
    activeCity = selectedCity;
    map.flyTo({ center: cityCenters[activeCity], zoom: 12 });
    loadLayers();
  }
});


  // Year toggle buttons
  document.getElementById('toggle-2025').onclick = () => {
    activeYear = '2025';
    document.getElementById('toggle-2025').classList.add('active');
    document.getElementById('toggle-2050').classList.remove('active');
    loadLayers();
  };

  document.getElementById('toggle-2050').onclick = () => {
    activeYear = '2050';
    document.getElementById('toggle-2050').classList.add('active');
    document.getElementById('toggle-2025').classList.remove('active');
    loadLayers();
  };

  // ✅ Initial load of correct layers and legend for 2025
  loadLayers();
});
