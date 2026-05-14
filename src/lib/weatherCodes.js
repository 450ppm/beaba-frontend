// WMO weather codes (Open-Meteo) -> emoji + courte description.
// Source: https://open-meteo.com/en/docs

const TABLE = {
  0: { icon: '☀️', label: 'Ciel clair' },
  1: { icon: '🌤️', label: 'Peu nuageux' },
  2: { icon: '⛅', label: 'Partiellement nuageux' },
  3: { icon: '☁️', label: 'Couvert' },
  45: { icon: '🌫️', label: 'Brouillard' },
  48: { icon: '🌫️', label: 'Brouillard givrant' },
  51: { icon: '🌦️', label: 'Bruine legere' },
  53: { icon: '🌦️', label: 'Bruine' },
  55: { icon: '🌦️', label: 'Bruine forte' },
  56: { icon: '🌧️', label: 'Bruine verglacante' },
  57: { icon: '🌧️', label: 'Bruine verglacante forte' },
  61: { icon: '🌧️', label: 'Pluie legere' },
  63: { icon: '🌧️', label: 'Pluie' },
  65: { icon: '🌧️', label: 'Pluie forte' },
  66: { icon: '🌧️', label: 'Pluie verglacante' },
  67: { icon: '🌧️', label: 'Pluie verglacante forte' },
  71: { icon: '🌨️', label: 'Neige legere' },
  73: { icon: '🌨️', label: 'Neige' },
  75: { icon: '🌨️', label: 'Neige forte' },
  77: { icon: '🌨️', label: 'Grains de neige' },
  80: { icon: '🌦️', label: 'Averses' },
  81: { icon: '🌧️', label: 'Averses fortes' },
  82: { icon: '⛈️', label: 'Averses violentes' },
  85: { icon: '🌨️', label: 'Averses de neige' },
  86: { icon: '🌨️', label: 'Averses de neige fortes' },
  95: { icon: '⛈️', label: 'Orage' },
  96: { icon: '⛈️', label: 'Orage avec grele' },
  99: { icon: '⛈️', label: 'Orage violent' },
};

export function weatherIcon(code) {
  return TABLE[code]?.icon || '•';
}

export function weatherLabel(code) {
  return TABLE[code]?.label || 'Inconnu';
}
