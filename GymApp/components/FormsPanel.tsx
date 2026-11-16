import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, Linking, ScrollView, StyleSheet,
} from 'react-native';
import { Colors } from '../constants/colors';
import {
  getForms, createForm, deleteForm, sendForm, getFormsSentTo, getMyForms,
} from '../services/api';
import { notify, confirmAction } from '../services/ui';

const FB = 'Barlow-Regular';
const FBB = 'Barlow-Bold';
const FC = 'BarlowCondensed-ExtraBold';

export type Pal = { bg: string; surface: string; text: string; textSub: string; border: string };

const fmtDate = (iso: string) => {
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

function openLink(url: string) {
  Linking.openURL(url).catch(() => notify('Error', 'No se pudo abrir el enlace'));
}

// ─── Entrenador: sus formularios (alta y borrado) ───────────────────────────
export function TrainerForms({ C }: { C: Pal }) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setForms(await getForms()); } catch (e: any) { notify('Error', e?.message || 'No se pudieron cargar los formularios'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!title.trim() || !url.trim()) { notify('Formulario', 'Escribe un título y pega el enlace.'); return; }
    setSaving(true);
    try {
      await createForm(title.trim(), url.trim());
      setAdding(false); setTitle(''); setUrl('');
      await load();
    } catch (e: any) {
      notify('Error', e?.message || 'No se pudo guardar el formulario');
    } finally { setSaving(false); }
  };

  const remove = (f: any) => {
    confirmAction(
      'Borrar formulario',
      `¿Borrar "${f.title}"? También desaparecerá de la lista de los clientes que lo recibieron.`,
      'Borrar',
      async () => {
        try { await deleteForm(f.id); await load(); } catch (e: any) { notify('Error', e?.message || 'No se pudo borrar'); }
      },
      true,
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={st.header}>
        <Text style={[st.title, { color: C.text }]}>Formularios</Text>
        <TouchableOpacity onPress={() => setAdding(true)} accessibilityLabel="Añadir formulario">
          <Text style={{ color: Colors.primary, fontFamily: FBB, fontSize: 14 }}>+ Añadir</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={Colors.primary} /> : forms.length === 0 ? (
        <View style={[st.empty, { borderColor: C.border }]}>
          <Text style={[st.emptyTitle, { color: C.text }]}>Aún no hay formularios</Text>
          <Text style={[st.emptySub, { color: C.textSub }]}>
            Crea tu formulario en Google Forms, copia el enlace de "Enviar" y pégalo aquí. Después podrás mandarlo a tus clientes desde su ficha.
          </Text>
        </View>
      ) : (
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          {forms.map((f, i) => (
            <View key={f.id} style={[st.row, { borderBottomColor: C.border, borderBottomWidth: i === forms.length - 1 ? 0 : 1 }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openLink(f.url)} accessibilityLabel={`Abrir ${f.title}`}>
                <Text style={[st.rowTitle, { color: C.text }]} numberOfLines={1}>{f.title}</Text>
                <Text style={[st.rowSub, { color: C.textSub }]} numberOfLines={1}>{f.url}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(f)} accessibilityLabel={`Borrar ${f.title}`}>
                <Text style={{ color: '#EF4444', fontFamily: FBB, fontSize: 13 }}>Borrar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={st.overlay}>
          <View style={[st.modalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[st.modalTitle, { color: C.text }]}>Nuevo formulario</Text>
            <View style={{ gap: 6 }}>
              <Text style={[st.label, { color: C.textSub }]}>Título</Text>
              <TextInput
                style={[st.input, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
                value={title} onChangeText={setTitle} placeholder="Cuestionario inicial" placeholderTextColor={C.textSub} maxLength={100}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[st.label, { color: C.textSub }]}>Enlace de Google Forms</Text>
              <TextInput
                style={[st.input, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
                value={url} onChangeText={setUrl} placeholder="https://docs.google.com/forms/..." placeholderTextColor={C.textSub}
                autoCapitalize="none" autoCorrect={false} keyboardType="url"
              />
            </View>
            <View style={st.btns}>
              <TouchableOpacity style={[st.btnCancel, { borderColor: C.border }]} onPress={() => setAdding(false)} disabled={saving}>
                <Text style={{ color: C.textSub, fontFamily: FBB, fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btnOk, { backgroundColor: Colors.primary, opacity: saving ? 0.6 : 1 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: FBB, fontSize: 15 }}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Entrenador: enviar un formulario a un cliente (desde su ficha) ─────────
export function SendFormModal({ C, client, onClose }: { C: Pal; client: any | null; onClose: () => void }) {
  const [forms, setForms] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const [f, s] = await Promise.all([getForms(), getFormsSentTo(client.id)]);
      setForms(f); setSent(s);
    } catch (e: any) { notify('Error', e?.message || 'No se pudieron cargar los formularios'); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { load(); }, [load]);

  const send = async (f: any) => {
    setSendingId(f.id);
    try {
      const res = await sendForm(f.id, client.id);
      notify(
        res?.email_sent ? 'Formulario enviado' : 'Formulario asignado',
        res?.email_sent
          ? `Se ha enviado un correo a ${client.email} y el cliente lo verá también en su Perfil.`
          : 'No se pudo enviar el correo, pero el cliente ya lo ve en su Perfil, en "Mis formularios".',
      );
      await load();
    } catch (e: any) {
      notify('Error', e?.message || 'No se pudo enviar el formulario');
    } finally { setSendingId(null); }
  };

  return (
    <Modal visible={!!client} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={[st.modalCard, { backgroundColor: C.surface, borderColor: C.border, maxHeight: '85%' }]}>
          <Text style={[st.modalTitle, { color: C.text }]} numberOfLines={2}>Enviar formulario a {client?.name}</Text>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            {loading ? <ActivityIndicator color={Colors.primary} /> : forms.length === 0 ? (
              <Text style={{ color: C.textSub, fontFamily: FB }}>
                Todavía no has añadido formularios. Hazlo en tu Perfil, en el apartado "Formularios".
              </Text>
            ) : forms.map(f => (
              <View key={f.id} style={[st.sendRow, { borderColor: C.border, backgroundColor: C.bg }]}>
                <Text style={[st.rowTitle, { color: C.text, flex: 1 }]} numberOfLines={2}>{f.title}</Text>
                <TouchableOpacity
                  style={[st.sendBtn, { backgroundColor: Colors.primary, opacity: sendingId === f.id ? 0.6 : 1 }]}
                  onPress={() => send(f)} disabled={sendingId !== null}
                  accessibilityLabel={`Enviar ${f.title}`}
                >
                  {sendingId === f.id ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: FBB, fontSize: 14 }}>Enviar</Text>}
                </TouchableOpacity>
              </View>
            ))}

            {sent.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={[st.label, { color: C.textSub }]}>Enviados a este cliente</Text>
                {sent.map(x => (
                  <Text key={x.id} style={{ color: C.text, fontFamily: FB, fontSize: 13 }}>
                    {x.title} · {fmtDate(x.sent_at)}{x.email_sent ? '' : ' · sin correo'}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={[st.btnCancel, { borderColor: C.border, flex: 0 }]} onPress={onClose}>
            <Text style={{ color: C.textSub, fontFamily: FBB, fontSize: 15 }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cliente: formularios que le ha enviado su entrenador ───────────────────
export function MyForms({ C }: { C: Pal }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyForms().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null; // sin formularios, no se muestra la sección

  return (
    <View style={{ gap: 12 }}>
      <Text style={[st.title, { color: C.text }]}>Mis formularios</Text>
      <View style={[st.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        {items.map((f, i) => (
          <View key={f.id} style={[st.row, { borderBottomColor: C.border, borderBottomWidth: i === items.length - 1 ? 0 : 1 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[st.rowTitle, { color: C.text }]} numberOfLines={2}>{f.title}</Text>
              <Text style={[st.rowSub, { color: C.textSub }]}>Recibido el {fmtDate(f.sent_at)}</Text>
            </View>
            <TouchableOpacity
              style={[st.sendBtn, { backgroundColor: Colors.primary }]}
              onPress={() => openLink(f.url)}
              accessibilityLabel={`Abrir ${f.title}`}
            >
              <Text style={{ color: '#fff', fontFamily: FBB, fontSize: 14 }}>Rellenar</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontFamily: FBB },
  card: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  rowTitle: { fontSize: 15, fontFamily: FBB },
  rowSub: { fontSize: 12, fontFamily: FB },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 20, gap: 6, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontFamily: FBB },
  emptySub: { fontSize: 13, fontFamily: FB, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 16 },
  modalTitle: { fontSize: 22, lineHeight: 24, fontFamily: FC },
  label: { fontSize: 13, fontFamily: FBB },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, fontFamily: FB },
  btns: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  btnOk: { flex: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  sendBtn: { borderRadius: 10, minHeight: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
