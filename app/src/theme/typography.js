// Cozy typography. Nunito is a warm, rounded sans — friendly without being
// childish. We load four weights and reference them by family name (the weight
// is baked into the family, which is how custom fonts work on React Native).
//
// Loaded in app/_layout.js via useFonts; until that resolves the app shows the loading
// screen, so these families are always available by the time UI renders.
export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  display: 'Nunito_800ExtraBold',
};
