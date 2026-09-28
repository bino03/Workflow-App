import { theme as antdTheme, type MappingAlgorithm, type ThemeConfig } from 'antd';

// Espelho de index.css (--wfa-*) — tokens-and-colors.md §10. Mudar um valor é mudá-lo nos dois.
const brand = {
  accent: '#A88FFF',
  accentHover: '#B9A9FF',
  accentPressed: '#9379E7',
  accentSubtle: '#27223C',
  accentBorder: '#574A86',
  onAccent: '#0C0D14',
  success: '#6AD18A',
  warning: '#EEA743',
  error: '#FF958D',
  info: '#64C1FF',
  surface2: '#171820',
  surface3: '#1F2029',
  text1: '#EFF0F6',
};

/*
 * O darkAlgorithm deriva as cores de marca a partir da semente (#A88FFF sai #927DDC, #FF958D sai
 * #DC827B). Este passo corre depois dele e repõe os valores exatos dos tokens.
 */
const pinBrandColors: MappingAlgorithm = (seed, map = antdTheme.darkAlgorithm(seed)) => ({
  ...map,
  colorPrimary: brand.accent,
  colorPrimaryHover: brand.accentHover,
  colorPrimaryActive: brand.accentPressed,
  colorPrimaryBg: brand.accentSubtle,
  colorPrimaryBgHover: brand.accentSubtle,
  colorPrimaryBorder: brand.accentBorder,
  colorPrimaryBorderHover: brand.accentBorder,
  colorPrimaryText: brand.accent,
  colorPrimaryTextHover: brand.accentHover,
  colorPrimaryTextActive: brand.accentPressed,
  colorSuccess: brand.success,
  colorWarning: brand.warning,
  colorError: brand.error,
  colorInfo: brand.info,
});

export const theme: ThemeConfig = {
  algorithm: [antdTheme.darkAlgorithm, pinBrandColors],
  token: {
    colorPrimary: brand.accent,
    colorSuccess: brand.success,
    colorWarning: brand.warning,
    colorError: brand.error,
    colorInfo: brand.info,
    colorLink: brand.accent,
    colorTextLightSolid: brand.onAccent, // texto sobre primary/error = on-accent
    colorBgBase: '#090911',
    colorBgLayout: '#090911',
    colorBgContainer: '#101018',
    colorBgElevated: brand.surface2,
    colorBgSpotlight: brand.surface3,
    colorBorder: '#40424B',
    colorBorderSecondary: '#2A2B33',
    colorText: brand.text1,
    colorTextSecondary: '#BBBDC8',
    colorTextTertiary: '#9799A4',
    colorBgMask: 'rgba(0,0,0,.62)',
    borderRadius: 5,
    borderRadiusSM: 3,
    borderRadiusLG: 8,
    fontFamily: "'Geist', sans-serif",
    fontFamilyCode: "'Geist Mono', monospace",
    fontSize: 14,
    motionDurationFast: '0.12s',
    motionDurationMid: '0.18s',
    motionDurationSlow: '0.26s',
    motionEaseOut: 'cubic-bezier(.2,0,0,1)',
  },
  components: {
    // O colorTextLightSolid escuro deixava o texto do tooltip ilegível sobre o fundo escuro.
    Tooltip: { colorTextLightSolid: brand.text1 },
    // Diálogo de confirmação: título 18/24 (drawers-and-modals.md → Confirmações).
    Modal: { titleFontSize: 18, titleLineHeight: 24 / 18 },
  },
};
