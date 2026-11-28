import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { G, FC, FB, FBB, GROUP_COLORS, badge } from './shared';
import type { Exercise } from './shared';

interface DetailModalProps {
  exercise: Exercise | null;
  onClose: () => void;
}

export default function ExerciseDetailModal({ exercise, onClose }: DetailModalProps) {
  if (!exercise) return null;
  const gc = GROUP_COLORS[exercise.muscle_group] ?? GROUP_COLORS.default;
  return (
    <Modal visible={!!exercise} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={s.detailSafeArea}>
        <View style={s.detailTopBar}>
          <View style={[badge.box, { backgroundColor: gc.bg, marginTop: 0 }]}>
            <Text style={[badge.text, { color: gc.text }]}>{exercise.muscle_group}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.detailCloseBtn}>
            <Text style={s.detailCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces>
          <View style={s.detailContent}>
            <View style={[s.detailNameAccent, { backgroundColor: gc.accent }]} />
            <Text style={s.detailName}>{exercise.name}</Text>
            {exercise.description ? (
              <View style={s.detailDescBlock}>
                <Text style={s.detailSectionLabel}>DESCRIPCIÓN</Text>
                <Text style={s.detailDescription}>{exercise.description}</Text>
              </View>
            ) : (
              <View style={s.detailNoDesc}>
                <Text style={s.detailNoDescTxt}>Sin descripción disponible</Text>
              </View>
            )}
            {exercise.video_url && (
              <TouchableOpacity style={s.videoButton} onPress={() => Linking.openURL(exercise.video_url!)} activeOpacity={0.8}>
                <View style={s.videoButtonIcon}><Text style={{ color: G.white, fontSize: 14 }}>▶</Text></View>
                <Text style={s.videoButtonText}>Ver vídeo del ejercicio</Text>
              </TouchableOpacity>
            )}
            {exercise.image_url ? (
              <Image source={{ uri: exercise.image_url }} style={s.detailImage} resizeMode="contain" />
            ) : (
              <View style={[s.detailImagePlaceholder, { backgroundColor: gc.bg }]}>
                <Text style={{ fontFamily: FC, fontSize: 88, color: gc.text }}>
                  {exercise.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity style={s.detailCloseFull} onPress={onClose}>
              <Text style={s.detailCloseFullTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  detailSafeArea: {
    flex: 1,
    backgroundColor: G.white,
  },

  detailTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E6DD',
    backgroundColor: G.white,
  },

  detailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    marginTop: 24,
  },

  detailImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  detailContent: {
    padding: 24,
    paddingBottom: 48,
  },

  detailNameAccent: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },

  detailName: {
    fontSize: 40,
    color: G.textMain,
    letterSpacing: -0.3,
    lineHeight: 42,
    fontFamily: FC,
    marginBottom: 20,
  },

  detailCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: G.bgPage,
    borderWidth: 1,
    borderColor: '#E3E6DD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  detailCloseTxt: {
    fontSize: 14,
    color: G.textSub,
  },

  detailDescBlock: {
    marginBottom: 8,
  },

  detailSectionLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: G.textHint,
    fontFamily: FBB,
    marginBottom: 8,
  },

  detailDescription: {
    fontSize: 16,
    color: G.textMain,
    fontFamily: FB,
    lineHeight: 25,
  },

  detailNoDesc: {
    backgroundColor: G.bgPage,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E3E6DD',
    marginBottom: 8,
  },

  detailNoDescTxt: {
    fontSize: 13,
    color: G.textSub,
    fontFamily: FB,
    textAlign: 'center',
  },

  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: G.primary,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
  },

  videoButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: G.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },

  videoButtonText: {
    fontSize: 15,
    color: G.white,
    fontFamily: FBB,
    flex: 1,
  },

  detailCloseFull: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border,
    alignItems: 'center',
  },

  detailCloseFullTxt: {
    fontSize: 14,
    color: G.textMain,
    fontFamily: FBB,
  },
});
