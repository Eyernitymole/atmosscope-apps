export const DEFAULT_CITY = Object.freeze({
  name: '广州', admin1: '广东', country: '中国', latitude: 23.1291, longitude: 113.2644,
});

const finite = value => value === null || value === undefined || value === ''
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const item = (values, index) => Array.isArray(values) && index < values.length
  ? finite(values[index]) : null;

export function normalizePlaces(payload) {
  return (Array.isArray(payload?.results) ? payload.results : [])
    .filter(place => typeof place?.name === 'string' && place.name.trim() &&
      finite(place.latitude) !== null && Math.abs(finite(place.latitude)) <= 90 &&
      finite(place.longitude) !== null && Math.abs(finite(place.longitude)) <= 180)
    .slice(0, 5)
    .map(place => ({
      name: place.name, admin1: typeof place.admin1 === 'string' ? place.admin1 : '',
      country: typeof place.country === 'string' ? place.country : '',
      latitude: Number(place.latitude), longitude: Number(place.longitude),
    }));
}

function dayKey(seconds, timeZone) {
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function weatherLabel(code) {
  const value = finite(code);
  if (value === 0) return '晴';
  if ([1, 2, 3].includes(value)) return '多云';
  if ([45, 48].includes(value)) return '雾';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return '雨';
  if ([71, 73, 75, 77, 85, 86].includes(value)) return '雪';
  if ([95, 96, 99].includes(value)) return '雷暴';
  return '未分类天气';
}

export function normalizeForecast(payload, {nowMs = Date.now()} = {}) {
  if (payload?.error) throw new Error(payload.reason || '数据源错误');
  let timeZone = payload?.timezone || 'UTC';
  try { new Intl.DateTimeFormat('zh-CN', {timeZone}).format(0); }
  catch { timeZone = 'UTC'; }

  const c = payload?.current;
  const current = c && typeof c === 'object' ? {
    timestamp: finite(c.time), temperature: finite(c.temperature_2m),
    apparent: finite(c.apparent_temperature), humidity: finite(c.relative_humidity_2m),
    wind: finite(c.wind_speed_10m), weatherCode: finite(c.weather_code),
  } : null;
  const h = payload?.hourly || {};
  const hours = (Array.isArray(h.time) ? h.time : []).map((raw, index) => ({
    timestamp: finite(raw), temperature: item(h.temperature_2m, index),
    weatherCode: item(h.weather_code, index),
    precipitation: item(h.precipitation, index),
    probability: item(h.precipitation_probability, index),
  })).filter(hour => hour.timestamp !== null && hour.timestamp * 1000 >= nowMs)
    .sort((a, b) => a.timestamp - b.timestamp).slice(0, 24);
  const d = payload?.daily || {};
  const days = (Array.isArray(d.time) ? d.time : []).slice(0, 7).map((raw, index) => ({
    date: dayKey(finite(raw), timeZone), high: item(d.temperature_2m_max, index),
    low: item(d.temperature_2m_min, index), weatherCode: item(d.weather_code, index),
    precipitation: item(d.precipitation_sum, index),
    probability: item(d.precipitation_probability_max, index),
  }));
  return {timeZone, updatedAt: current?.timestamp ?? null, current, hours, days};
}
