import { StyleSheet } from 'react-native';

// Colores, textos y tipos que comparten las piezas de la pantalla de ejercicios.

export const G = {
  primary:     '#3B6D11',
  primaryDark: '#27500A',
  primaryLt:   '#EAF3DE',
  white:       '#FFFFFF',
  bgPage:      '#F2F5EE',
  border:      '#D3D1C7',
  textMain:    '#1A1A1A',
  textSub:     '#5F5E5A',
  textHint:    '#888780',
  danger:      '#E24B4A',
};

export const FC  = 'BarlowCondensed-ExtraBold';
export const FB  = 'Barlow-Regular';
export const FBB = 'Barlow-Bold';

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  description?: string;
  image_url?: string;
  video_url?: string;
};

export const MUSCLE_GROUPS = ['Todos', 'Calentamiento', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Abdomen'];

export const GROUP_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Pecho:   { bg: '#EAF3DE', text: '#27500A', accent: '#3B6D11' },
  Espalda: { bg: '#EEF2FF', text: '#3730A3', accent: '#6366F1' },
  Piernas: { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B' },
  Hombros: { bg: '#FCE7F3', text: '#9D174D', accent: '#EC4899' },
  Bíceps:  { bg: '#E0F2FE', text: '#075985', accent: '#0EA5E9' },
  Tríceps: { bg: '#F0FDF4', text: '#14532D', accent: '#22C55E' },
  Abdomen: { bg: '#FFF7ED', text: '#9A3412', accent: '#F97316' },
  Calentamiento: { bg: '#FEF9C3', text: '#854D0E', accent: '#EAB308' },
  default: { bg: '#F1F5F9', text: '#475569', accent: '#94A3B8' },
};

export const EMPTY_FORM = {
  name: '', muscle_group: 'Pecho', description: '', image_url: '', video_url: '',
};

// Etiqueta del grupo muscular (la usan la tarjeta y el detalle)
export const badge = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },

  text: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FBB,
  },
});
