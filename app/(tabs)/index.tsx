// app/(tabs)/index.tsx
import { Buffer } from 'buffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
  SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme,
  View
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { saveDocx } from '../../utils/saveDocx';

/* ────────── types / consts ────────────────────────────────────────── */
type Msg = { role:'user'|'assistant'; content:string };
const API = 'http://10.0.0.96:8000';
// const API = 'http://localhost:8000';


/* ────────── component ─────────────────────────────────────────────── */
export default function ChatScreen() {
  /* state */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState('');
  const [inputH,   setInputH]   = useState(40);
  const [picked,   setPicked]   = useState<DocumentPicker.DocumentPickerAsset|null>(null);
  const [busy,     setBusy]     = useState(false);
  const [origin,   setOrigin]   = useState('output.docx');

  /* theme: system + manual toggle */
  const sysScheme = useColorScheme();                     // 'light' | 'dark'
  const [force, setForce] = useState<'light'|'dark'|null>('dark');
  const scheme  = force ?? sysScheme ?? 'light';
  const C       = scheme === 'dark' ? dark : light;
  const styles  = makeStyles(C);

  const listRef = useRef<FlatList>(null);

  /* always scroll to end on new message */
  useEffect(()=>{ listRef.current?.scrollToEnd({ animated:true }); }, [messages]);

  /* ── helpers ─────────────────────────────────────────────────────── */
  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory:true });
    if (!res.canceled && res.assets?.length) {
      setPicked(res.assets[0]);
      setOrigin(res.assets[0].name.replace(/\.[^/.]+$/, '.docx'));
    }
  };

  const send = async () => {
    if (busy) return;
    if (!input && !picked) return alert('Type something or pick a document');
    setBusy(true);

    const body: any = { history: messages };
    if (picked) {
      const base64 = Platform.OS==='web'
        ? Buffer.from(await (await fetch(picked.uri)).arrayBuffer()).toString('base64')
        : await FileSystem.readAsStringAsync(picked.uri, { encoding:FileSystem.EncodingType.Base64 });
      body.fileB64 = base64; body.fileName = picked.name;
    } else {
      body.text = input;
    }

    try {
      const { assistant, error } = await fetch(`${API}/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
      }).then(r=>r.json());

      if (error) alert(error);
      else setMessages(m => [...m,
            { role:'user',      content: picked ? '(file uploaded)' : input },
            { role:'assistant', content: assistant }]);

      setInput(''); setPicked(null);
    } catch { alert('Network error'); }
    setBusy(false);
  };

  const download = async () => {
    const last = [...messages].reverse().find(m=>m.role==='assistant');
    if (!last) return alert('Nothing to save yet');

    /* prompt name */
    const stem = await new Promise<string|null>(res=>{
      if (Platform.OS==='web') return res(window.prompt('File name (no .docx)', origin.replace(/\.docx$/,'')));
      Alert.prompt('Save as','Enter file name (without .docx)',
        [{text:'Cancel',style:'cancel',onPress:()=>res(null)},
         {text:'OK',    onPress:txt=>res(txt?.trim()||null)}],
        'plain-text', origin.replace(/\.docx$/,''));
    });
    if (stem===null) return;
    const want = (stem||'output') + '.docx';

    const { b64, fileName, error } = await fetch(`${API}/download`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ content:last.content, fileName:'reply_'+want })
    }).then(r=>r.json());

    if (error) return alert(error);
    await saveDocx(b64, fileName);
  };

  const toggleTheme = () => setForce(f => f ? (f === 'light' ? 'dark' : 'light') : (sysScheme === 'light' ? 'dark' : 'light'));

  /* ── UI ───────────────────────────────────────────────────────────── */
  return (
<SafeAreaView style={styles.safe}>
  {/* header with theme toggle */}
  <View style={styles.header}>
    <Text style={styles.headTxt}>📄 DocuAI</Text>
    <TouchableOpacity onPress={toggleTheme}>
      <Text style={styles.headIcon}>{scheme === 'light' ? '🌞' : '🌙'}</Text>
    </TouchableOpacity>
  </View>

  {/* keyboard-aware area */}
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.select({ ios: 'padding', android: 'height' })}>

    {/* wrapper so FlatList takes spare space */}
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={[styles.msg, item.role === 'user' ? styles.user : styles.bot]}>
            {item.role === 'assistant'
              ? <Markdown style={{ body: { color: C.text } }}>{item.content}</Markdown>
              : <Text style={{ color: C.text }}>{item.content}</Text>}
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}
      />
    </View>

    {picked && <Text style={styles.fileNote}>📎 {picked.name}</Text>}

    {/* input row */}
    <View style={styles.inputRow}>
      <TouchableOpacity style={styles.iconBtn} onPress={pickFile}>
        <Text style={styles.iconTxt}>📁</Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.input, { height: Math.max(40, Math.min(120, inputH)) }]}
        placeholder="Type a message…"
        placeholderTextColor={C.placeholder}
        multiline
        value={input}
        onChangeText={setInput}
        onContentSizeChange={e => setInputH(e.nativeEvent.contentSize.height)}
      />

      {busy
        ? <ActivityIndicator color={C.accent} style={{ marginLeft: 8 }} />
        : <TouchableOpacity style={styles.iconBtn} onPress={send}>
            <Text style={styles.iconTxt}>➤</Text>
          </TouchableOpacity>}
    </View>

    <TouchableOpacity style={styles.dlBtn} onPress={download}>
      <Text style={styles.dlTxt}>⬇️  Download .docx</Text>
    </TouchableOpacity>
  </KeyboardAvoidingView>
</SafeAreaView>

  );
}

/* ── palettes & styles (light / dark) ────────────────────────────────── */
const light = {
  bg:'#f9fafb', cardUser:'#e0e7ff', cardBot:'#ffffff', borderBot:'#e5e7eb',
  accent:'#4f46e5', text:'#111827', placeholder:'#6b7280', link:'#1e40af'
};
const dark = {
  bg:'#111827', cardUser:'#1e3a8a', cardBot:'#1f2937', borderBot:'#374151',
  accent:'#6366f1', text:'#f9fafb', placeholder:'#9ca3af', link:'#93c5fd'
};

const makeStyles = (C:any)=>StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},
  header:{flexDirection:'row',justifyContent:'space-between',
          alignItems:'center',padding:16},
  headTxt:{fontSize:18,fontWeight:'700',color:C.text},
  headIcon:{fontSize:22},
  msg:{padding:10,marginVertical:4,borderRadius:10,maxWidth:'82%'},
  user:{alignSelf:'flex-end',backgroundColor:C.cardUser},
  bot :{alignSelf:'flex-start',backgroundColor:C.cardBot,
        borderWidth:1,borderColor:C.borderBot},
  fileNote:{marginLeft:16,color:C.placeholder},
  inputRow:{flexDirection:'row',alignItems:'flex-end',
            paddingHorizontal:16,paddingTop:4,paddingBottom:12,gap:8},
  iconBtn:{backgroundColor:C.accent,borderRadius:10,padding:12},
  iconTxt:{color:'#fff',fontSize:16},
  input:{flex:1,backgroundColor:C.cardBot,color:C.text,
         borderWidth:1,borderColor:C.borderBot,borderRadius:10,
         paddingHorizontal:10,paddingTop:8,paddingBottom:8},
  dlBtn:{alignSelf:'center',marginBottom:30},
  dlTxt:{color:C.link,fontWeight:'600'}
});