import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { G, FC, FB, FBB, GROUP_COLORS, badge } from './shared';
import type { Exercise } from './shared';

export interface ExerciseCardProps {
  item: Exercise;
  isAdmin: boolean;
  onView: (item: Exercise) => void;
  onEdit: (item: Exercise) => void;
  onDelete: (item: Exercise) => void;
}

export default function ExerciseCard({ item, isAdmin, onView, onEdit, onDelete }: ExerciseCardProps) {
  const gc = GROUP_COLORS[item.muscle_group] ?? GROUP_COLORS.default;

  return (
    <View style={s.card}>

      {/* ZONA CLICABLE (editar/ver) */}
      <TouchableOpacity
        style={{ flex: 1, flexDirection: 'row' }}
        onPress={() => isAdmin ? onEdit(item) : onView(item)}
        onLongPress={() => onView(item)}
        activeOpacity={0.75}
      >
        <View style={[s.cardStripe, { backgroundColor: gc.accent }]} />

        <View style={[s.cardBody, isAdmin && { paddingBottom: 40 }]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={s.cardThumb} />
          ) : (
            <View style={[s.cardThumbPlaceholder, { backgroundColor: gc.bg }]}>
              <Text style={{ fontFamily: FC, fontSize: 30, color: gc.text }}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={s.cardInfo}>
            <Text style={s.cardName} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={[badge.box, { backgroundColor: gc.bg }]}>
              <Text style={[badge.text, { color: gc.text }]}>
                {item.muscle_group}
              </Text>
            </View>

            {item.description ? (
              <Text style={s.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : (
              <Text style={s.cardDescEmpty}>Sin descripción</Text>
            )}
          </View>

        </View>
      </TouchableOpacity>

      {/* BOTÓN DELETE SEPARADO */}
      {isAdmin && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 14,
            bottom: 8,
            paddingVertical: 8,
            paddingHorizontal: 6,
            zIndex: 10,
          }}
          hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
          onPress={() => onDelete(item)}
        >
          <Text style={{ color: G.danger, fontSize: 13, fontFamily: FBB }}>Eliminar</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: G.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E6DD',
    overflow: 'hidden',

    minHeight: 104,
  },

  cardStripe: {
    width: 4,
  },

  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },

  cardThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
  },

  cardThumbPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardInfo: {
    flex: 1,
    gap: 4,
  },

  cardName: {
    fontSize: 24,
    color: G.textMain,
    fontFamily: FC,
    lineHeight: 26,
  },

  cardDesc: {
    fontSize: 13,
    color: G.textSub,
    fontFamily: FB,
    lineHeight: 18,
    marginTop: 2,
  },

  cardDescEmpty: {
    fontSize: 12,
    color: G.textHint,
    fontFamily: FB,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
