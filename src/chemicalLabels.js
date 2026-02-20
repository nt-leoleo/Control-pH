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

export const getConfiguredProducts = (chlorineType, acidType) => {
  const raiseCode = chlorineType || 'sodium-hypochlorite';
  const lowerCode = acidType || 'muriatic';
  return {
    raiseCode,
    lowerCode,
    raiseName: getChemicalName(raiseCode),
    lowerName: getChemicalName(lowerCode),
  };
};
