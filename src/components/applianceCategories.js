// Liste des categories d'appareils + helpers d'icone / label.
// Sortie dans un module separe pour eviter le warning react-refresh/only-export-components.

export const APPLIANCE_CATEGORIES = [
  { id: 'fridge', label: 'Frigo', icon: '🥶' },
  { id: 'freezer', label: 'Congelateur', icon: '🧊' },
  { id: 'tv', label: 'TV', icon: '📺' },
  { id: 'computer', label: 'Ordinateur', icon: '🖥️' },
  { id: 'router', label: 'Box / Routeur', icon: '🌐' },
  { id: 'oven', label: 'Four', icon: '🍳' },
  { id: 'microwave', label: 'Micro-ondes', icon: '🍱' },
  { id: 'dishwasher', label: 'Lave-vaisselle', icon: '🍽️' },
  { id: 'washer', label: 'Lave-linge', icon: '👕' },
  { id: 'dryer', label: 'Seche-linge', icon: '🧺' },
  { id: 'kettle', label: 'Bouilloire', icon: '🫖' },
  { id: 'coffee', label: 'Cafetiere', icon: '☕' },
  { id: 'heating', label: 'Chauffage', icon: '🔥' },
  { id: 'ac', label: 'Climatisation', icon: '❄️' },
  { id: 'water_heater', label: 'Chauffe-eau', icon: '🚿' },
  { id: 'lighting', label: 'Eclairage', icon: '💡' },
  { id: 'hairdryer', label: 'Seche-cheveux', icon: '💨' },
  { id: 'console', label: 'Console / Multimedia', icon: '🎮' },
  { id: 'charger', label: 'Chargeur / Petite electronique', icon: '🔌' },
  { id: 'other', label: 'Autre', icon: '📦' },
];

const CATEGORY_BY_ID = Object.fromEntries(
  APPLIANCE_CATEGORIES.map((c) => [c.id, c])
);

export function categoryIcon(id) {
  return CATEGORY_BY_ID[id]?.icon || '🔌';
}

export function categoryLabel(id) {
  return CATEGORY_BY_ID[id]?.label || '';
}

// Mappe les categories de suggestion (heuristique) vers nos categories UI.
export const SUGGESTION_TO_CATEGORY = {
  fridge: 'fridge',
  standby: 'charger',
  heating: 'heating',
  kettle: 'kettle',
  tv_computer: 'tv',
  router: 'router',
  washer: 'washer',
};
