export const CHEMICAL_NAMES = {
  'sodium-hypochlorite': 'Hipoclorito de sodio',
  'calcium-hypochlorite': 'Hipoclorito de calcio',
  'chlorine-gas': 'Cloro gas',
  muriatic: 'Acido muriatico',
  bisulfate: 'Bisulfato de sodio',
};

export const getChemicalName = (code) => {
  if (!code) return 'Producto configurado';
  return CHEMICAL_NAMES[code] || code;
};

const RAISE_PRODUCTS = ['sodium-hypochlorite', 'calcium-hypochlorite'];
const LOWER_PRODUCTS = ['muriatic', 'bisulfate', 'chlorine-gas'];

const sanitizeConfiguredProduct = (code, allowed, fallback) => {
  if (!code) return fallback;
  return allowed.includes(code) ? code : fallback;
};

export const getConfiguredProducts = (chlorineType, acidType) => {
  const raiseCode = sanitizeConfiguredProduct(chlorineType, RAISE_PRODUCTS, 'sodium-hypochlorite');
  const lowerCode = sanitizeConfiguredProduct(acidType, LOWER_PRODUCTS, 'muriatic');
  return {
    raiseCode,
    lowerCode,
    raiseName: getChemicalName(raiseCode),
    lowerName: getChemicalName(lowerCode),
  };
};
