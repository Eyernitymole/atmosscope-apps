import {DEFAULT_CITY, normalizePlaces, normalizeForecast, weatherLabel} from './ordinary-data.mjs';

export function isStoredCity(city) {
  return typeof city?.name === 'string' && Boolean(city.name.trim()) &&
    Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90 &&
    Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180;
}

export function createRequestOwner() {
  let generation = 0;
  let controller;
  return {
    next() {
      controller?.abort();
      controller = new AbortController();
      return {id: ++generation, signal: controller.signal};
    },
    current(id) { return id === generation; },
  };
}

const forecastFields = {
  current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
  hourly: 'temperature_2m,weather_code,precipitation,precipitation_probability',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
};
const forecastUrl = city => 'https://api.open-meteo.com/v1/forecast?' +
  new URLSearchParams({latitude: String(city.latitude), longitude: String(city.longitude),
    ...forecastFields, forecast_days: '7', timezone: 'auto', timeformat: 'unixtime'});
const placesUrl = query => 'https://geocoding-api.open-meteo.com/v1/search?' +
  new URLSearchParams({name: query, count: '5', language: 'zh', format: 'json'});
const value = (number, unit = '') => number === null ? '暂无数据' : `${number}${unit}`;
const condition = code => code === null ? '暂无数据' : weatherLabel(code);

function init() {
  const $ = id => document.getElementById(id);
  const elements = {
    form: $('cityForm'), query: $('cityQuery'), results: $('cityResults'),
    status: $('statusText'), city: $('cityName'), zone: $('cityTimeZone'),
    updated: $('updatedAt'), current: $('currentPanel'), hours: $('hourlyList'),
    days: $('dailyList'), refresh: $('refreshBtn'),
  };
  const owner = createRequestOwner();
  let activeCity = DEFAULT_CITY;
  try {
    const stored = JSON.parse(localStorage.getItem('atmosscope-city'));
    if (isStoredCity(stored)) activeCity = stored;
  } catch { /* Storage is optional. */ }

  const setStatus = message => { elements.status.textContent = message; };
  function clearWeather() {
    elements.current.replaceChildren();
    elements.hours.replaceChildren();
    elements.days.replaceChildren();
    elements.updated.textContent = '数据时间：暂无数据';
    elements.zone.textContent = '城市时区：—';
  }
  const dateTime = (seconds, timeZone) => seconds === null ? '暂无数据' :
    new Intl.DateTimeFormat('zh-CN', {timeZone, month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false}).format(seconds * 1000);
  const hourTime = (seconds, timeZone) => seconds === null ? '暂无数据' :
    new Intl.DateTimeFormat('zh-CN', {timeZone, hour: '2-digit', minute: '2-digit',
      hour12: false}).format(seconds * 1000);
  function node(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function render(model, city) {
    elements.city.textContent = city.name + (city.admin1 ? ` · ${city.admin1}` : '');
    elements.zone.textContent = `城市时区：${model.timeZone}`;
    elements.updated.textContent = `数据时间：${dateTime(model.updatedAt, model.timeZone)}`;

    const heading = node('h2', '模式当前场');
    const main = node('div', '', 'current-main');
    main.append(node('strong', value(model.current?.temperature ?? null, '°C')),
      node('span', condition(model.current?.weatherCode ?? null)));
    const details = node('ul', '', 'current-detail');
    for (const [label, number, unit] of [
      ['体感', model.current?.apparent ?? null, '°C'],
      ['相对湿度', model.current?.humidity ?? null, '%'],
      ['10 m 风速', model.current?.wind ?? null, ' km/h'],
    ]) details.append(node('li', `${label} ${value(number, unit)}`));
    elements.current.replaceChildren(heading, main, details);

    elements.hours.replaceChildren();
    for (const hour of model.hours) {
      const row = node('li', '');
      row.append(node('time', hourTime(hour.timestamp, model.timeZone)),
        node('strong', value(hour.temperature, '°C')),
        node('span', condition(hour.weatherCode)),
        node('span', `降水 ${value(hour.precipitation, ' mm')}`),
        node('span', `概率 ${value(hour.probability, '%')}`));
      elements.hours.append(row);
    }
    if (!model.hours.length) elements.hours.append(node('li', '暂无逐小时预报', 'empty'));

    elements.days.replaceChildren();
    for (const day of model.days) {
      const row = node('li', '');
      row.append(node('time', day.date ?? '暂无日期'),
        node('strong', `${value(day.low, '°C')} / ${value(day.high, '°C')}`),
        node('span', condition(day.weatherCode)),
        node('span', `降水 ${value(day.precipitation, ' mm')}`),
        node('span', `最高概率 ${value(day.probability, '%')}`));
      elements.days.append(row);
    }
    if (!model.days.length) elements.days.append(node('li', '暂无逐日预报', 'empty'));
  }

  async function load(city) {
    const {id, signal} = owner.next();
    activeCity = city;
    elements.city.textContent = city.name + (city.admin1 ? ` · ${city.admin1}` : '');
    clearWeather();
    setStatus('正在加载模式预报…');
    try {
      const response = await fetch(forecastUrl(city), {signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const model = normalizeForecast(await response.json());
      if (!owner.current(id)) return;
      render(model, city);
      setStatus(!model.current || model.hours.length < 24 || model.days.length < 7
        ? '部分预报数据不足，缺测项显示为“暂无数据”。' : '模式预报已更新');
    } catch (error) {
      if (!owner.current(id)) return;
      clearWeather();
      setStatus(`预报获取失败：${error.message}`);
    }
  }

  elements.form.addEventListener('submit', async event => {
    event.preventDefault();
    const query = elements.query.value.trim();
    if (!query) return;
    const {id, signal} = owner.next();
    elements.results.replaceChildren();
    setStatus('正在搜索城市…');
    try {
      const response = await fetch(placesUrl(query), {signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.error) throw new Error(data.reason || '城市数据源错误');
      const places = normalizePlaces(data);
      if (!owner.current(id)) return;
      if (!places.length) { setStatus('未找到城市，请尝试更具体的名称。'); return; }
      for (const place of places) {
        const button = node('button', [place.name, place.admin1, place.country]
          .filter(Boolean).join(' · '));
        button.type = 'button';
        button.addEventListener('click', () => {
          elements.results.replaceChildren();
          try { localStorage.setItem('atmosscope-city', JSON.stringify(place)); }
          catch { /* Storage is optional. */ }
          load(place);
        });
        elements.results.append(button);
      }
      setStatus('请选择匹配的城市。');
    } catch (error) {
      if (owner.current(id)) setStatus(`城市搜索失败：${error.message}`);
    }
  });
  elements.refresh.addEventListener('click', () => load(activeCity));
  load(activeCity);
}

if (typeof document !== 'undefined') init();
