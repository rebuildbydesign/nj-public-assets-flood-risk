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

// --------------------------------------------------
// Boundary bounds cache (CRITICAL FIX)
// --------------------------------------------------
const boundaryBoundsByMun = {};

// --------------------------------------------------
// Asset colors
// --------------------------------------------------
const colors = {
  AIRPORT: "#111111",
  HOSPITAL: "#D7263D",
  KCS: "#FF8700",
  LIBRARY: "#FFD100",
  PARK: "#3FB950",
  POWERPLANT: "#8C1EFF",
  SCHOOL: "#FF5EBF",
  SOLIDHAZARD: "#A15500",
  SOLIDWASTE: "#FF3D00",
  SUPERFUND: "#C10087",
  WASTEWATER: "#5A5A5A"
};

const assetLabels = {
  AIRPORT: "AIRPORT",
  HOSPITAL: "HOSPITAL",
  KCS: "KNOWN CONTAMINATED SITE",
  LIBRARY: "LIBRARY",
  PARK: "PARK",
  POWERPLANT: "POWER PLANT",
  SCHOOL: "SCHOOL",
  SOLIDHAZARD: "SOLID & HAZARD WASTE SITE",
  SOLIDWASTE: "SOLID WASTE LANDFILL",
  SUPERFUND: "SUPERFUND",
  WASTEWATER: "WASTEWATER TREATMENT PLANT"
};


// --------------------------------------------------
// Layer visibility + filters
// --------------------------------------------------
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
  map.setFilter('boundary', ['==', ['get', 'MUN'], activeCity]);

  map.once('idle', () => updateLegend(assetId));
}

// --------------------------------------------------
// Legend
// --------------------------------------------------
function updateLegend(assetId) {
  const legend = document.getElementById('legend');
  if (!legend) return;

  const layer = map.getLayer(assetId);
  if (!layer) return;

  const sourceId = layer.source;

  // ⚠️ Get features (may include duplicates)
  const rawFeatures = map.querySourceFeatures(sourceId, {
    filter: ['==', ['get', 'MUN'], activeCity]
  });

  // ✅ Deduplicate by UNIQUE_ID
  const uniqueFeatures = {};
  rawFeatures.forEach(f => {
    const id = f.properties.UNIQUE_ID;
    if (id) uniqueFeatures[id] = f;
  });

  const features = Object.values(uniqueFeatures);
  const totalAssets = features.length;

  // Header
  legend.innerHTML = `
    <h3>Step 3: Review Legend</h3>
    <p class="legend-helper">
      <strong>${activeCity}</strong> has
      <strong>${totalAssets}</strong> public assets exposed
      (${activeYear} flood scenario).
    </p>
  `;

  // Count by asset type
  const counts = {};
  features.forEach(f => {
    const type = f.properties.ASSET;
    counts[type] = (counts[type] || 0) + 1;
  });

  // Render legend rows
  Object.keys(counts).sort().forEach(type => {
    const color = colors[type] || '#999';
    const label = assetLabels[type] || type;

    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `
      <span class="legend-color" style="background-color:${color}"></span>
      ${label} (${counts[type]})
    `;
    legend.appendChild(div);
  });
}




// --------------------------------------------------
// Zoom to municipality (STABLE + CACHED)
// --------------------------------------------------
function zoomToMunicipality(munName) {
  const bounds = boundaryBoundsByMun[munName];
  if (!bounds) return;

  map.stop();

  map.fitBounds(bounds, {
    padding: {
      top: 60,
      bottom: 60,
      left: 340,   // sidebar width
      right: 60
    },

    // ✅ SMALL corrective nudge (not half the sidebar)
    offset: [-50, 0],

    duration: 2000,
    linear: false,
    maxZoom: 14,
    essential: true
  });
}




// --------------------------------------------------
// Map load
// --------------------------------------------------
map.on('load', () => {

  // ---- Boundary source & layer ----
  map.addSource('boundary', {
    type: 'geojson',
    data: 'data/boundary.json'
  });

  map.addLayer({
    id: 'boundary',
    type: 'line',
    source: 'boundary',
    paint: {
      'line-color': 'rgba(255, 0, 0, 0.6)',
      'line-width': 3,
      'line-dasharray': [2, 2]
    },
    filter: ['==', ['get', 'MUN'], activeCity]
  });

  // ---- Precompute boundary bounds ONCE ----
  fetch('data/boundary.json')
    .then(res => res.json())
    .then(geojson => {
      geojson.features.forEach(f => {
        const mun = f.properties?.MUN;
        if (!mun) return;

        const bounds = new mapboxgl.LngLatBounds();
        const geom = f.geometry;

        if (geom.type === 'Polygon') {
          geom.coordinates[0].forEach(c => bounds.extend(c));
        }

        if (geom.type === 'MultiPolygon') {
          geom.coordinates.forEach(p =>
            p[0].forEach(c => bounds.extend(c))
          );
        }

        boundaryBoundsByMun[mun] = bounds;
      });

      // initial zoom after bounds are ready
      zoomToMunicipality(activeCity);
    });

  // ---- Floodplain + assets ----
  ['2025', '2050'].forEach(year => {

    map.addSource(`floodplain_${year}`, {
      type: 'geojson',
      data: `data/floodplain_${year}.json`
    });

    map.addLayer({
      id: `floodplain_${year}`,
      type: 'fill',
      source: `floodplain_${year}`,
      paint: {
        'fill-color': 'rgba(0, 183, 255, 0.3)'
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
        'circle-color': [
          'match',
          ['get', 'ASSET'],
          ...Object.entries(colors).flat(),
          '#cccccc'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      },
      layout: { visibility: year === '2025' ? 'visible' : 'none' },
      filter: ['==', ['get', 'MUN'], activeCity]
    });
  });

  // ---- Hover popup ----
map.on('mousemove', e => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: [`assets_${activeYear}`]
  });

  map.getCanvas().style.cursor = features.length ? 'pointer' : '';

  if (popup) popup.remove();

  if (features.length) {
    const f = features[0];
    const name = f.properties.NAME
      ? f.properties.NAME.toUpperCase()
      : '';

    popup = new mapboxgl.Popup({ closeButton: false })
      .setLngLat(f.geometry.coordinates)
      .setHTML(`<strong>${name}</strong>`)
      .addTo(map);
  }
});


  map.on('mouseleave', 'assets_2025', () => popup && popup.remove());
  map.on('mouseleave', 'assets_2050', () => popup && popup.remove());

  // ---- Municipality dropdown ----
  document.getElementById('municipality-select').addEventListener('change', e => {
    activeCity = e.target.value;
    loadLayers();
    zoomToMunicipality(activeCity);
  });

  // ---- Year toggles ----
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

  // ---- Initial state ----
  loadLayers();
});


const methodologyLink = document.getElementById('methodology-link');
const methodologyPopup = document.getElementById('methodology-popup');
const closeMethodology = document.getElementById('close-methodology');

methodologyLink.addEventListener('click', e => {
  e.preventDefault();
  methodologyPopup.classList.remove('hidden');
});

closeMethodology.addEventListener('click', () => {
  methodologyPopup.classList.add('hidden');
});

// Optional: click outside to close
methodologyPopup.addEventListener('click', e => {
  if (e.target === methodologyPopup) {
    methodologyPopup.classList.add('hidden');
  }
});
