// ========================================
// MAPBOX INITIALIZATION
// ========================================
mapboxgl.accessToken = 'pk.eyJ1IjoiajAwYnkiLCJhIjoiY2x1bHUzbXZnMGhuczJxcG83YXY4czJ3ayJ9.S5PZpU9VDwLMjoX_0x5FDQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/j00by/cml8tkndp003e01qofxow4fbd',
  center: [-74.1724, 40.7357], // Newark default
  zoom: 12
});

// Add navigation controls (zoom, rotate, pitch)
map.addControl(new mapboxgl.NavigationControl(), 'top-right');


// ========================================
// STATE VARIABLES
// ========================================
let activeYear = "2025";
let activeCity = "NEWARK CITY";
let popup = null;

// Boundary bounds cache - stores precomputed map bounds for each municipality
const boundaryBoundsByMun = {};

// ========================================
// ASSET COLORS - Map data types to colors
// ========================================
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

// ========================================
// ASSET LABELS - User-friendly display names
// ========================================
const assetLabels = {
  AIRPORT: "Airport",
  HOSPITAL: "Hospital",
  KCS: "Known Contaminated Site",
  LIBRARY: "Library",
  PARK: "Park",
  POWERPLANT: "Powerplant",
  SCHOOL: "School",
  SOLIDHAZARD: "Solid & Hazard Waste Site",
  SOLIDWASTE: "Solid Waste Landfill",
  SUPERFUND: "Superfund",
  WASTEWATER: "Wastewater Treatment Plant"
};

// ========================================
// MUNICIPALITY DISPLAY NAMES - Clean labels for legend
// ========================================
const municipalityLabels = {
  "NEWARK CITY": "Newark",
  "ELIZABETH CITY": "Elizabeth",
  "CAMDEN CITY": "Camden",
  "TRENTON CITY": "Trenton",
  "JERSEY CITY": "Jersey City",
  "PATERSON CITY": "Paterson",
  "ASBURY PARK CITY": "Asbury Park",
  "ATLANTIC CITY": "Atlantic City"
};

// ========================================
// LAYER VISIBILITY CONTROL
// Toggle between 2025 and 2050 scenarios
// ========================================
function loadLayers() {
  const floodId = `floodplain_${activeYear}`;
  const assetId = `assets_${activeYear}`;
  
  // Hide all layers first
  ["floodplain_2025", "floodplain_2050", "assets_2025", "assets_2050"].forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  });
  
  // Show active year layers
  map.setLayoutProperty(floodId, 'visibility', 'visible');
  map.setLayoutProperty(assetId, 'visibility', 'visible');
  
  // Filter to active municipality
  map.setFilter(assetId, ['==', ['get', 'MUN'], activeCity]);
  map.setFilter('boundary', ['==', ['get', 'MUN'], activeCity]);
  
  // Update legend after map finishes rendering
  map.once('idle', () => updateLegend(assetId));
}

// ========================================
// UPDATE LEGEND
// Dynamically builds legend based on visible assets
// ========================================
function updateLegend(assetId) {
  const legend = document.getElementById('legend');
  if (!legend) return;
  
  const layer = map.getLayer(assetId);
  if (!layer) return;
  
  const sourceId = layer.source;
  
  // Get features (may include duplicates)
  const rawFeatures = map.querySourceFeatures(sourceId, {
    filter: ['==', ['get', 'MUN'], activeCity]
  });
  
  // Deduplicate by UNIQUE_ID
  const uniqueFeatures = {};
  rawFeatures.forEach(f => {
    const id = f.properties.UNIQUE_ID;
    if (id) uniqueFeatures[id] = f;
  });
  const features = Object.values(uniqueFeatures);
  const totalAssets = features.length;
  
  // Build legend header
  const cityDisplayName = municipalityLabels[activeCity] || activeCity;
  
  legend.innerHTML = `
    <h3>Step 3: Explore Exposed Assets</h3>
    <p class="legend-helper">
      <strong>${cityDisplayName}</strong> has
      <strong>${totalAssets}</strong> public assets exposed
      (${activeYear} flood scenario).
    </p>
  `;
  
  // Count assets by type
  const counts = {};
  features.forEach(f => {
    const type = f.properties.ASSET;
    counts[type] = (counts[type] || 0) + 1;
  });
  
  // Render legend items
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


// ========================================
// ZOOM TO MUNICIPALITY
// Fits map viewport to selected municipality boundary
// ========================================
function zoomToMunicipality(munName) {
  const bounds = boundaryBoundsByMun[munName];
  if (!bounds) return;
  
  // Detect mobile
  const isMobile = window.innerWidth <= 768;
  
  map.stop();
  map.fitBounds(bounds, {
    padding: isMobile ? {
      top: 80,
      bottom: window.innerHeight * 0.55, // Account for 50vh sidebar + toggle
      left: 20,
      right: 20
    } : {
      top: 60,
      bottom: 60,
      left: 340,   // Account for sidebar width on desktop
      right: 60
    },
    offset: isMobile ? [0, 0] : [-50, 0],
    duration: 2000,
    linear: false,
    maxZoom: isMobile ? 12 : 14, // Lower max zoom on mobile for better overview
    essential: true
  });
}


// ========================================
// MAP LOAD EVENT
// Initialize all map layers and event listeners
// ========================================
map.on('load', () => {
  
  // ---- Add municipality boundary layer ----
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
  
  // ---- Precompute boundary bounds for zoom function ----
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
      
      // Initial zoom after bounds are ready
      zoomToMunicipality(activeCity);
    });
  
  // ---- Add floodplain and asset layers for both years ----
  ['2025', '2050'].forEach(year => {
    
    // FIXED: Add parentheses for function calls
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
    
    // FIXED: Add parentheses for function calls
    map.addSource(`assets_${year}`, {
      type: 'geojson',
      data: `data/assets_${year}.geojson`
    });
    

     // Detect mobile for responsive sizing
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;

    
    map.addLayer({
      id: `assets_${year}`,
      type: 'circle',
      source: `assets_${year}`,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, isMobile ? 3 : 4,      // Smaller dots when zoomed out
          12, isMobile ? 5 : 6,     // Medium dots at default zoom
          16, isMobile ? 7 : 9      // Larger dots when zoomed in
        ],
        'circle-color': [
          'match',
          ['get', 'ASSET'],
          ...Object.entries(colors).flat(),
          '#cccccc'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': isMobile ? 0.5 : 1,  // Thinner stroke on mobile
        'circle-opacity': isMobile ? 0.9 : 1,       // Slightly transparent on mobile
        'circle-stroke-opacity': isMobile ? 0.8 : 1
      },
      layout: { visibility: year === '2025' ? 'visible' : 'none' },
      filter: ['==', ['get', 'MUN'], activeCity]
    });
  });
  
  // ---- Hover popup on asset points ----
  map.on('mousemove', e => {
    // FIXED: Add proper array syntax
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
      
      // FIXED: Add parentheses for function call
      popup = new mapboxgl.Popup({ closeButton: false })
        .setLngLat(f.geometry.coordinates)
        .setHTML(`<strong>${name}</strong>`)
        .addTo(map);
    }
  });
  
  map.on('mouseleave', 'assets_2025', () => popup && popup.remove());
  map.on('mouseleave', 'assets_2050', () => popup && popup.remove());
  
  // ---- Municipality dropdown event ----
  document.getElementById('municipality-select').addEventListener('change', e => {
    activeCity = e.target.value;
    loadLayers();
    zoomToMunicipality(activeCity);
  });
  
  // ---- Year toggle button events ----
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
  
  // ---- Load initial state ----
  loadLayers();
});

// ========================================
// CSV DOWNLOAD FUNCTIONALITY
// ========================================
document.getElementById('download-csv').addEventListener('click', () => {
  const assetId = `assets_${activeYear}`;
  const layer = map.getLayer(assetId);
  
  if (!layer) {
    alert('No data available to download');
    return;
  }
  
  const sourceId = layer.source;
  
  // Get features for current municipality
  const rawFeatures = map.querySourceFeatures(sourceId, {
    filter: ['==', ['get', 'MUN'], activeCity]
  });
  
  // Deduplicate by UNIQUE_ID
  const uniqueFeatures = {};
  rawFeatures.forEach(f => {
    const id = f.properties.UNIQUE_ID;
    if (id) uniqueFeatures[id] = f;
  });
  
  const features = Object.values(uniqueFeatures);
  
  if (features.length === 0) {
    alert('No exposed assets found for this municipality');
    return;
  }
  
  // Build CSV content
  const headers = [
    'Asset_Name',
    'Asset_Type',
    'County',
    'Municipality',
    'Unique_ID',
    'Flood_Scenario',
    'Longitude',
    'Latitude'
  ];
  
  let csvContent = headers.join(',') + '\n';
  
  features.forEach(f => {
    const props = f.properties;
    const coords = f.geometry.coordinates;
    
    // Extract data, handling potential commas in names
    const name = (props.NAME || 'Unknown').replace(/,/g, ';');
    const assetType = assetLabels[props.ASSET] || props.ASSET || 'Unknown';
    const county = (props.COUNTY || 'Unknown').replace(/,/g, ';');
    const municipality = municipalityLabels[props.MUN] || props.MUN || 'Unknown';
    const uniqueId = props.UNIQUE_ID || 'Unknown';
    const scenario = activeYear;
    const longitude = coords[0].toFixed(6);
    const latitude = coords[1].toFixed(6);
    
    const row = [
      name,
      assetType,
      county,
      municipality,
      uniqueId,
      scenario,
      longitude,
      latitude
    ];
    
    csvContent += row.join(',') + '\n';
  });
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // Generate filename
  const cityName = municipalityLabels[activeCity] || activeCity;
  const cleanCityName = cityName.replace(/\s+/g, '_');
  const filename = `${cleanCityName}_${activeYear}_flood_exposed_assets.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});



// ========================================
// METHODOLOGY POPUP CONTROLS
// ========================================
const methodologyLink = document.getElementById('methodology-link');
const methodologyPopup = document.getElementById('methodology-popup');
const closeMethodology = document.getElementById('close-methodology');

// Open popup
methodologyLink.addEventListener('click', e => {
  e.preventDefault();
  methodologyPopup.classList.remove('hidden');
});

// Close popup via button
closeMethodology.addEventListener('click', () => {
  methodologyPopup.classList.add('hidden');
});

// Close popup by clicking outside
methodologyPopup.addEventListener('click', e => {
  if (e.target === methodologyPopup) {
    methodologyPopup.classList.add('hidden');
  }
});

