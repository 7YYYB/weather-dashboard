// Weather Dashboard with Open-Meteo, Leaflet, Chart.js
// Features: geocoding search, map selection, hourly forecast with precipitation probability,
// 7-day forecast, unit toggle °C/°F, weather icons (Weather Icons CSS), chart for temp + precip

const $ = (sel) => document.querySelector(sel);
const suggestionsEl = $('#suggestions');
const input = $('#city-input');
const locationEl = $('#location');
const tempEl = $('#temp');
const descEl = $('#desc');
const windEl = $('#wind');
const pressureEl = $('#pressure');
const daysEl = $('#days');
const hoursList = $('#hours-list');
const unitBtn = $('#unitBtn');
const ctx = document.getElementById('tempChart').getContext('2d');

let chart = null;
let debounceTimer = null;
let map, marker;
let unit = localStorage.getItem('unit') || 'C'; // 'C' or 'F'

unitBtn.textContent = unit === 'C' ? '°C' : '°F';

// Weather code to weather-icons mapping (partial)
const weatherIconMap = {
  0: 'wi-day-sunny',
  1: 'wi-day-sunny-overcast',
  2: 'wi-day-cloudy',
  3: 'wi-cloudy',
  45: 'wi-fog',
  48: 'wi-fog',
  51: 'wi-sprinkle',
  53: 'wi-sprinkle',
  55: 'wi-rain',
  61: 'wi-rain',
  63: 'wi-rain',
  65: 'wi-rain',
  71: 'wi-snow',
  73: 'wi-snow',
  75: 'wi-snow',
  80: 'wi-showers',
  81: 'wi-showers',
  82: 'wi-showers',
  95: 'wi-thunderstorm',
  96: 'wi-thunderstorm',
};

function iconForCode(code){
  return weatherIconMap[code] || 'wi-na';
}

function c2f(c){ return c * 9/5 + 32; }
function f2c(f){ return (f - 32) * 5/9; }

function formatTemp(t){
  if (unit === 'C') return `${t.toFixed(1)} °C`;
  return `${c2f(t).toFixed(1)} °F`;
}

// Debounced search
input.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  const q = e.target.value.trim();
  if (!q) { suggestionsEl.classList.remove('show'); return; }
  debounceTimer = setTimeout(() => searchCity(q), 300);
});

// click outside to hide suggestions
document.addEventListener('click', (e) => {
  if (!suggestionsEl.contains(e.target) && e.target !== input) suggestionsEl.classList.remove('show');
});

async function searchCity(q){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=zh`;
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    showSuggestions(data.results || []);
  }catch(err){
    showSuggestions([]);
    console.error(err);
  }
}

function showSuggestions(list){
  suggestionsEl.innerHTML = '';
  if (!list.length) {
    suggestionsEl.classList.remove('show');
    return;
  }
  list.forEach(item=>{
    const li = document.createElement('li');
    li.textContent = `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}${item.country ? ' · ' + item.country : ''}`;
    li.tabIndex = 0;
    li.role = 'option';
    li.addEventListener('click', ()=> selectLocation(item));
    li.addEventListener('keydown', (e)=> { if (e.key === 'Enter') selectLocation(item);});
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.classList.add('show');
}

async function selectLocation(place){
  suggestionsEl.classList.remove('show');
  input.value = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}${place.country ? ' · ' + place.country : ''}`;
  const lat = place.latitude;
  const lon = place.longitude;
  localStorage.setItem('lastPlace', JSON.stringify({name: input.value, lat, lon}));
  if (map) {
    map.setView([lat, lon], 10);
    if (marker) marker.setLatLng([lat, lon]);
    else marker = L.marker([lat, lon]).addTo(map);
  }
  await fetchWeather(lat, lon, input.value);
}

async function fetchWeather(lat, lon, label){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('天气请求失败');
    const data = await res.json();
    renderWeather(data, label);
  }catch(err){
    console.error(err);
    locationEl.textContent = '获取天气失败';
    descEl.textContent = '';
  }
}

function renderWeather(data, label){
  const cw = data.current_weather;
  locationEl.textContent = label || `${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)}`;
  const iconClass = iconForCode(cw.weathercode);
  tempEl.innerHTML = `${formatTemp(cw.temperature)}`;
  descEl.innerHTML = `<i class="wi ${iconClass}" style="font-size:1.3rem;margin-right:6px"></i> 风向 ${cw.winddirection}°`;
  windEl.textContent = `${cw.windspeed} m/s`;
  // pressure not in current response by default; set placeholder
  pressureEl.textContent = '—';

  // daily
  const days = data.daily.time.map((d,i)=>({
    date: d,
    max: data.daily.temperature_2m_max[i],
    min: data.daily.temperature_2m_min[i],
    code: data.daily.weathercode[i]
  }));
  renderForecast(days);

  // hourly: find next 24 hours starting from current hour
  const now = new Date();
  const hours = data.hourly.time.map((t,i)=>({
    time: t,
    temp: data.hourly.temperature_2m[i],
    pop: data.hourly.precipitation_probability ? data.hourly.precipitation_probability[i] : 0,
    code: data.hourly.weathercode ? data.hourly.weathercode[i] : 0
  }));
  // find index of current hour
  let startIdx = hours.findIndex(h => new Date(h.time) >= now);
  if (startIdx === -1) startIdx = 0;
  const next24 = hours.slice(startIdx, startIdx + 24);
  renderHours(next24);
  renderChart(next24);
}

function renderForecast(days){
  daysEl.innerHTML = '';
  days.forEach(d=>{
    const date = new Date(d.date);
    const weekday = date.toLocaleDateString(undefined, {weekday:'short'});
    const iconClass = iconForCode(d.code);
    const div = document.createElement('div');
    div.className = 'day';
    div.innerHTML = `<div>${weekday}</div><div>${date.getMonth()+1}/${date.getDate()}</div><div><i class="wi ${iconClass}"></i></div><div class="dtemp">${unit==='C'?d.max.toFixed(1):c2f(d.max).toFixed(1)}° / ${unit==='C'?d.min.toFixed(1):c2f(d.min).toFixed(1)}°</div>`;
    daysEl.appendChild(div);
  });
}

function renderHours(hours){
  hoursList.innerHTML = '';
  hours.forEach(h=>{
    const date = new Date(h.time);
    const hr = date.getHours();
    const div = document.createElement('div');
    div.className = 'hour-item';
    const iconClass = iconForCode(h.code);
    div.innerHTML = `<div class="hr">${hr}:00</div><div class="icon"><i class="wi ${iconClass}"></i></div><div class="htemp">${unit==='C'?h.temp.toFixed(1):c2f(h.temp).toFixed(1)}°</div><div class="hpop" style="color:var(--muted);font-size:0.85rem">降雨 ${h.pop ?? 0}%</div>`;
    hoursList.appendChild(div);
  });
}

function renderChart(hours){
  const labels = hours.map(h => {
    const d = new Date(h.time);
    return `${d.getHours()}:00`;
  });
  const temps = hours.map(h => unit==='C' ? h.temp : c2f(h.temp));
  const pops = hours.map(h => h.pop ?? 0);

  const data = {
    labels,
    datasets: [
      {
        label: `温度 (${unit==='C'?'°C':'°F'})`,
        data: temps,
        yAxisID: 'y',
        borderColor: 'rgb(43,140,255)',
        backgroundColor: 'rgba(43,140,255,0.12)',
        tension: 0.3
      },
      {
        label: '降雨概率 (%)',
        data: pops,
        yAxisID: 'y1',
        borderColor: 'rgb(0,128,0)',
        backgroundColor: 'rgba(0,128,0,0.08)',
        tension: 0.3
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { type: 'linear', position: 'left' },
      y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: (v)=>`${v}%` } }
    }
  };

  if (chart){ chart.data = data; chart.options = options; chart.update(); return; }
  chart = new Chart(ctx, { type: 'line', data, options });
}

// Map init
function initMap(){
  map = L.map('map').setView([39.9042, 116.4074], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', async (e) => {
    const {lat, lng} = e.latlng;
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng]).addTo(map);
    input.value = '';
    localStorage.setItem('lastPlace', JSON.stringify({name: `Lat ${lat.toFixed(3)}, Lon ${lng.toFixed(3)}`, lat, lon: lng}));
    await fetchWeather(lat, lng, `Lat ${lat.toFixed(3)}, Lon ${lng.toFixed(3)}`);
  });
}

// Unit toggle
unitBtn.addEventListener('click', () => {
  unit = unit === 'C' ? 'F' : 'C';
  localStorage.setItem('unit', unit);
  unitBtn.textContent = unit === 'C' ? '°C' : '°F';
  // re-render using lastPlace if available
  const last = localStorage.getItem('lastPlace');
  if (last){
    try{
      const p = JSON.parse(last);
      fetchWeather(p.lat, p.lon, p.name);
    }catch(e){ }
  }
});

// On load
window.addEventListener('load', async ()=>{
  initMap();
  const last = localStorage.getItem('lastPlace');
  if (last){
    try{
      const parsed = JSON.parse(last);
      if (parsed.name) input.value = parsed.name;
      // adjust map
      if (parsed.lat && parsed.lon){
        map.setView([parsed.lat, parsed.lon], 10);
        marker = L.marker([parsed.lat, parsed.lon]).addTo(map);
        await fetchWeather(parsed.lat, parsed.lon, parsed.name);
        return;
      }
    }catch(e){ }
  }
  // default: Beijing
  await fetchWeather(39.9042, 116.4074, 'Beijing, CN');
});
