// =========================
// Configuración general
// =========================

// Códigos de acceso válidos (lista proporcionada)
const ACCESS_CODES = [
  "E5LNK6YH","FQ8ASX6J","NXYLXJA4","HHJK4FN6","K7LL2KVF",
  "VVU2QU9V","YLSWHGCP","CTAE5HS7","87FUQ875","LWKKBWBH",
  "DZFND7D6","C4CXMYH9","DVR2EKR7","FGNEC9LN","72H6TQFT",
  "TEKWTUAX","8E2E63DY","57ULA4VR","BCCP7WXC","BA23NYZ3",
  "GYJC2GHP","WHHETBYM","8JTKULZB","W5PFPXU3","8GY88ELX",
  "GQ37REVH","9ZRJJ2DX","MGF9U5QT","U4JLEJ86","C8XDLYD8",
  "758A3VPK","MREBKKCT","WKVY7P7N","JQY2MZCJ","HTR3QLPK",
  "8R42EFT3","GNVJJL6U","FSZC3ZAV","PGTFQ7MJ","735GANYM",
  "S59SDS7K","N7YL4SA7","HYL6NCYF","DFS68EYU","QG93ZD39",
  "GL77ATN4","UVZCY9V8","Y6Y28V25","G95XSKSG","E34JB3AB"
];

// Centro aproximado del área de estudio
const MAP_CENTER = [(-18.6394 + -18.4582) / 2, (-64.0729 + -64.1601) / 2]; // ~[-18.5488, -64.1165]
const MAP_ZOOM = 11;

// Capas de datos (rutas relativas)
const LAYERS = {
  UE: "data/UE_ESEARHV.geojson",
  UH: "data/UH_ESEARHV.geojson",
  LimLegal: "data/LIM_ESEARHV.geojson"
};

// URLs de descarga (ZIP)
const DOWNLOAD_URLS = {
  UE_ESEARHV: "data/shp/UE_ESEARHV.zip",
  UH_ESEARHV: "data/shp/UH_ESEARHV.zip"
};

// =========================
// Inicialización del mapa
// =========================

const map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);

// Capas base
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
});

const googleSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
  attribution: "Tiles © Esri"
});

osm.addTo(map);
const baseMaps = {
  "OpenStreetMap": osm,
  "Google Satellite": googleSat
};
L.control.layers(baseMaps, {}, { collapsed: false }).addTo(map);

// Capas temáticas (se llenarán tras cargar los GeoJSON)
let ueLayer = null;
let uhLayer = null;
let limLegalLayer = null;

// Estilos
const styleUE = (feature) => {
  const idue = feature.properties.IDUE;
  // Colores según IDUE (1–9)
  const colors = {
    1: "#00734C",
    2: "#38A800",
    3: "#9ADC42",
    4: "#FFFF73",
    5: "#E1E1E1",
    6: "#FFBEE8",
    7: "#000000",
    8: "#FF5500",
    9: "#0070FF"
  };
  return {
    fillColor: colors[idue] || "#cccccc",
    fillOpacity: 0.7,
    color: "transparent", // Borde transparente
    weight: 0             // Grosor 0 para evitar cualquier línea
  };
};

const styleUH = {
  fillColor: "transparent",
  fillOpacity: 0,
  color: "#0070FF",
  weight: 2
};

const styleLimLegal = {
  fillColor: "transparent",
  fillOpacity: 0,
  color: "#5D8C3E", // verde caña
  weight: 2
};

// Cargar GeoJSON
Promise.all([
  fetch(LAYERS.UE).then(r => r.json()),
  fetch(LAYERS.UH).then(r => r.json()),
  fetch(LAYERS.LimLegal).then(r => r.json())
]).then(([ueData, uhData, limData]) => {
  // Unidades de estudio
  ueLayer = L.geoJSON(ueData, {
  style: styleUE,
  onEachFeature: (feature, layer) => {
    const props = feature.properties || {};
    // Muestra todos los atributos en crudo para depurar
    const lines = Object.entries(props).map(([k, v]) => `<strong>${k}:</strong> ${v}`);
    const popup = `<div style="min-width:200px; max-width:300px; max-height:250px; overflow:auto; font-size:0.85rem;">${lines.join("<br>")}</div>`;
    layer.bindPopup(popup);
  }
}).addTo(map);

  /// Unidades hidrológicas
uhLayer = L.geoJSON(uhData, {
  style: styleUH,
  interactive: false  // No captura clics
}).addTo(map);

// Límites legales
limLegalLayer = L.geoJSON(limData, {
  style: styleLimLegal,
  interactive: false  // No captura clics
}).addTo(map);

  // Añadir al control de capas
  const overlayMaps = {
    "Unidades de estudio": ueLayer,
    "Unidades hidrológicas": uhLayer,
    "Límites legales": limLegalLayer
  };
  L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

  // Inicializar dashboard con todos los datos
  initDashboard(ueData);
}).catch(err => {
  console.error("Error cargando las capas GeoJSON:", err);
  alert("No se pudieron cargar las capas del mapa. Verifica que los archivos GeoJSON existen en la carpeta 'data'.");
});

// =========================
// Acordeón de capítulos
// =========================

const accordionHeaders = document.querySelectorAll(".accordion-header");
accordionHeaders.forEach(header => {
  header.addEventListener("click", () => {
    const item = header.parentElement;
    const isActive = item.classList.contains("active");
    // Cerrar todos
    document.querySelectorAll(".accordion-item").forEach(it => it.classList.remove("active"));
    // Abrir este si no estaba activo
    if (!isActive) {
      item.classList.add("active");
    }
  });
});

// =========================
// Dashboard
// =========================

let ueGeoJSON = null;
let chartInstance = null;

function initDashboard(geojsonData) {
  ueGeoJSON = geojsonData;

  // Llenar selects de filtro según los atributos disponibles
  const filterTypeSelect = document.getElementById("filter-type");
  const filterValueSelect = document.getElementById("filter-value");

  filterTypeSelect.addEventListener("change", () => {
    const type = filterTypeSelect.value;
    if (type === "none") {
      filterValueSelect.innerHTML = '<option value="">-- Seleccione --</option>';
      filterValueSelect.disabled = true;
      updateChart();
      return;
    }

    // Obtener valores únicos del atributo seleccionado
    const values = new Set();
    ueGeoJSON.features.forEach(f => {
      const v = f.properties[type];
      if (v !== undefined && v !== null && v !== "") {
        values.add(String(v));
      }
    });

    filterValueSelect.innerHTML = '<option value="">-- Seleccione --</option>';
    Array.from(values).sort().forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      filterValueSelect.appendChild(opt);
    });
    filterValueSelect.disabled = false;
  });

  filterValueSelect.addEventListener("change", updateChart);

  // Gráfico inicial (sin filtro)
  updateChart();
}

function updateChart() {
  const filterType = document.getElementById("filter-type").value;
  const filterValue = document.getElementById("filter-value").value;

  // Filtrar features
  let features = ueGeoJSON.features;
  if (filterType !== "none" && filterValue !== "") {
    features = features.filter(f => String(f.properties[filterType]) === filterValue);
  }

  // Agrupar por IDUE (1–9) y sumar AreaHa
  const areaByIdue = {};
  for (let i = 1; i <= 9; i++) {
    areaByIdue[i] = 0;
  }

  features.forEach(f => {
    const idue = f.properties.IDUE;
    const area = Number(f.properties.AreaHa) || 0;
    if (idue >= 1 && idue <= 9) {
      areaByIdue[idue] += area;
    }
  });

  const labels = [];
  const data = [];
  const colors = [
    "#00734C","#38A800","#9ADC42","#FFFF73","#E1E1E1",
    "#FFBEE8","#000000","#FF5500","#0070FF"
  ];

  for (let i = 1; i <= 9; i++) {
    labels.push(`UE ${i}`);
    data.push(areaByIdue[i]);
  }

  const ctx = document.getElementById("areaChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Área total (ha)",
        data: data,
        backgroundColor: colors,
        borderColor: "#333333",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return `UE ${idx + 1}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Área (ha)"
          }
        },
        x: {
          title: {
            display: true,
            text: "Unidad de estudio (IDUE)"
          }
        }
      }
    }
  });
}

// Ajustar tamaño del gráfico al cambiar ventana
window.addEventListener("resize", () => {
  if (chartInstance) {
    chartInstance.resize();
  }
});

// =========================
// Descarga con código de acceso
// =========================

const modal = document.getElementById("access-modal");
const accessCodeInput = document.getElementById("access-code");
const accessError = document.getElementById("access-error");
const btnConfirm = document.getElementById("btn-confirm-download");
const btnCancel = document.getElementById("btn-cancel-download");

let currentLayerToDownload = null;

document.querySelectorAll(".btn-download").forEach(btn => {
  btn.addEventListener("click", () => {
    currentLayerToDownload = btn.getAttribute("data-layer");
    accessCodeInput.value = "";
    accessError.style.display = "none";
    modal.classList.add("active");
  });
});

btnCancel.addEventListener("click", () => {
  modal.classList.remove("active");
  currentLayerToDownload = null;
});

btnConfirm.addEventListener("click", () => {
  const code = accessCodeInput.value.trim();
  if (!ACCESS_CODES.includes(code)) {
    accessError.style.display = "block";
    return;
  }

  if (!currentLayerToDownload || !DOWNLOAD_URLS[currentLayerToDownload]) {
    alert("Capa no disponible para descarga.");
    modal.classList.remove("active");
    return;
  }

  // Iniciar descarga
  const url = DOWNLOAD_URLS[currentLayerToDownload];
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  modal.classList.remove("active");
  currentLayerToDownload = null;
});

// Cerrar modal al hacer clic fuera
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("active");
    currentLayerToDownload = null;
  }
});

// Leyenda como control flotante
const legendControl = L.control({ position: 'bottomright' });

legendControl.onAdd = () => {
  const div = L.DomUtil.create('div', 'leaflet-control-legend');
  div.innerHTML = `
    <div style="
      background: #ffffff;
      padding: 0.5rem 0.6rem;
      border-radius: 6px;
      border: 1px solid #b8ddd6;
      font-family: Cambria, serif;
      font-size: 0.8rem;
      max-width: 260px;
    ">
      <div style="
        font-weight: bold;
        margin-bottom: 0.3rem;
        color: #0f4c5c;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      " id="legend-title">
        <span>Unidades de estudio</span>
        <span id="legend-toggle" style="font-size:1rem;">−</span>
      </div>
      <ul id="legend-content" style="
        list-style: none;
        margin: 0;
        padding: 0;
        display: block;
      ">
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#00734C;border:1px solid #ccc;display:inline-block;"></span>
          1. Bosque cerrado siempre verde
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#38A800;border:1px solid #ccc;display:inline-block;"></span>
          2. Bosque semiabierto semideciduo
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#9ADC42;border:1px solid #ccc;display:inline-block;"></span>
          3. Bosque abierto semideciduo
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#FFFF73;border:1px solid #ccc;display:inline-block;"></span>
          4. Plantación forestal
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#E1E1E1;border:1px solid #ccc;display:inline-block;"></span>
          5. Afloramiento rocoso
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#FFBEE8;border:1px solid #ccc;display:inline-block;"></span>
          6. Cultivos agrícolas y forrajeros
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#000000;border:1px solid #ccc;display:inline-block;"></span>
          7. Infraestructuras civiles
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#FF5500;border:1px solid #ccc;display:inline-block;"></span>
          8. Suelos desnudos y erosionados
        </li>
        <li style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;">
          <span style="width:14px;height:14px;border-radius:2px;background:#0070FF;border:1px solid #ccc;display:inline-block;"></span>
          9. Cuerpos de agua superficial
        </li>
      </ul>
    </div>
  `;

  // Hacer que el control no intercepte eventos del mapa
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  // Toggle mostrar/ocultar leyenda
  const title = div.querySelector('#legend-title');
  const content = div.querySelector('#legend-content');
  const toggle = div.querySelector('#legend-toggle');
  let visible = true;

  title.addEventListener('click', () => {
    visible = !visible;
    content.style.display = visible ? 'block' : 'none';
    toggle.textContent = visible ? '−' : '+';
  });

  return div;
};

legendControl.addTo(map);
