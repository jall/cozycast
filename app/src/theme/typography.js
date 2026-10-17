// Campfire typography. Three voices:
//  - Fraunces (a soft, slightly wonky serif) for titles and *moments* — the
//    italic is the storyteller's voice ("Gather round.").
//  - Nunito (warm, rounded sans) for body and UI — the app's original face.
//  - DM Mono for time: durations, positions, timestamps, tiny eyebrows.
// We load each face once and reference it by family name (the weight is baked
// into the family, which is how custom fonts work on React Native — never set
// `fontWeight`).
//
// Loaded in app/_layout.js via useFonts; until that resolves the app shows the
// loading screen, so these families are always available by the time UI renders.
export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  display: 'Nunito_800ExtraBold',
  serif: 'Fraunces_500Medium',
  serifBold: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_500Medium_Italic',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
};
