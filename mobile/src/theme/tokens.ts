/**
 * Identidade visual "Sinalização Urbana".
 * As cores vêm da rua: asfalto, a tinta amarela das faixas (carro) e o verde das linhas de ônibus (coletivo).
 * A tipografia Barlow foi desenhada a partir de placas de trânsito: legível de longe, em qualquer idade.
 */
export const palette = {
  asfalto: '#18212E',
  asfaltoClaro: '#263243',
  papel: '#EDF0F3',
  branco: '#FFFFFF',
  faixa: '#F5B700',
  faixaEscura: '#8A6400',
  linha: '#087F59',
  linhaClara: '#10A876',
  sinal: '#D93D42',
  neblina: '#5F6B7B',
} as const;

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  header: string;
  headerText: string;
  headerMuted: string;
  car: string;
  carInk: string;
  carText: string;
  transit: string;
  transitText: string;
  danger: string;
  crowd: { vazio: string; moderado: string; lotado: string };
  traffic: { livre: string; moderado: string; intenso: string };
}

export const lightTheme: Theme = {
  dark: false,
  bg: palette.papel,
  surface: palette.branco,
  surfaceAlt: '#E3E7EC',
  text: palette.asfalto,
  textMuted: palette.neblina,
  border: '#D5DBE2',
  header: palette.asfalto,
  headerText: palette.branco,
  headerMuted: '#A9B4C2',
  car: palette.faixa,
  carInk: palette.asfalto,
  carText: palette.faixaEscura,
  transit: palette.linha,
  transitText: palette.linha,
  danger: palette.sinal,
  crowd: { vazio: palette.linha, moderado: '#B07A00', lotado: palette.sinal },
  traffic: { livre: palette.linha, moderado: '#B07A00', intenso: palette.sinal },
};

export const darkTheme: Theme = {
  dark: true,
  bg: '#0F151E',
  surface: '#182230',
  surfaceAlt: '#223042',
  text: '#E8EDF3',
  textMuted: '#9AA6B5',
  border: '#2A3747',
  header: '#0A0F16',
  headerText: '#F3F6F9',
  headerMuted: '#8D99A8',
  car: palette.faixa,
  carInk: palette.asfalto,
  carText: palette.faixa,
  transit: palette.linhaClara,
  transitText: '#3CCB98',
  danger: '#F06368',
  crowd: { vazio: '#3CCB98', moderado: '#F5B700', lotado: '#F06368' },
  traffic: { livre: '#3CCB98', moderado: '#F5B700', intenso: '#F06368' },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Raios diferentes por hierarquia: painel grande, peças médias, chips em pílula. */
export const radius = { panel: 22, piece: 12, track: 6, pill: 999 } as const;

export const fonts = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  numeral: 'BarlowSemiCondensed_700Bold',
  numeralMedium: 'BarlowSemiCondensed_600SemiBold',
} as const;

/** Escala tipográfica (razão ~1,25), com corpo de 17 para leitura confortável. */
export const type = {
  display: { fontFamily: fonts.numeral, fontSize: 40, lineHeight: 44 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 25 },
  small: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  numeral: { fontFamily: fonts.numeral, fontSize: 30, lineHeight: 34 },
  numeralSmall: { fontFamily: fonts.numeralMedium, fontSize: 20, lineHeight: 24 },
} as const;

export type TypeVariant = keyof typeof type;
