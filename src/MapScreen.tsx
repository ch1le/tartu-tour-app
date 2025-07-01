/********************************************************************
 * MapScreen.tsx – chat sheet (user messages only)
 *******************************************************************/
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Dimensions, View, Text, TextInput, ScrollView,
  ActivityIndicator, Platform, StatusBar, Pressable, KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useFonts, Raleway_500Medium } from '@expo-google-fonts/raleway';
import data from '../content.json';

/* ─── constants ───────────────────────── */
const MAX_SHEET_FRAC = 0.9;
const USER = { lat: 58.378, lon: 26.7221 };
const m2lonDeg = (m:number,lat:number)=>m/(111_320*Math.cos(lat*Math.PI/180));

/* simple static dot */
function DotMarker({ lat, lon }:{ lat:number; lon:number }){
  const [tracks,setTracks]=useState(true);
  useEffect(()=>{const id=setTimeout(()=>setTracks(false),300);return()=>clearTimeout(id);},[]);
  return <Marker coordinate={{ latitude:lat, longitude:lon }} tracksViewChanges={tracks}>
    <View style={styles.dot}/>
  </Marker>;
}
const UserMarker=()=>(
  <Marker coordinate={{ latitude:USER.lat, longitude:USER.lon }} tracksViewChanges={false}>
    <View style={styles.userPin}><Feather name="flag" size={22} color="#fff"/></View>
  </Marker>
);

/* ─── main component ─────────────── */
export default function MapScreen(){
  const [fontsLoaded]=useFonts({ Raleway_500Medium });
  const [messages,setMessages]=useState<string[]>([]);
  const [prompt,setPrompt]=useState('');
  const scrollRef=useRef<ScrollView>(null);

  /* map region */
  const targets=data.targets as { lat:number; lon:number; tag:string }[];
  const φ0=targets.reduce((s,t)=>s+t.lat,0)/targets.length;
  const λ0=targets.reduce((s,t)=>s+t.lon,0)/targets.length;
  const { width,height }=Dimensions.get('window');
  const λΔ=m2lonDeg(700,φ0); const φΔ=λΔ*(height/width);

  const onSend=()=>{
    const text=prompt.trim();
    if(!text) return;
    setMessages(prev=>[...prev,text]);
    setPrompt('');
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),50);
  };

  if(!fontsLoaded)
    return <View style={styles.loader}><ActivityIndicator size="large"/></View>;

  return(
    <KeyboardAvoidingView style={{flex:1}}
      behavior={Platform.OS==='ios'?'padding':'height'}
      keyboardVerticalOffset={STATUS+40}>
      <MapView style={styles.map}
        region={{ latitude:φ0, longitude:λ0, latitudeDelta:φΔ, longitudeDelta:λΔ }}>
        <UserMarker/>
        {targets.map((t,i)=><DotMarker key={i} lat={t.lat} lon={t.lon}/>)}
      </MapView>

      {/* CHAT SHEET */}
      <View style={[styles.sheet,{ maxHeight:height*MAX_SHEET_FRAC }]}>
        <View style={styles.handle}/>
        {/* header */}
        <View style={styles.ctaRow}>
          <LottieView source={require('../assets/lottie_surprise.json')}
            autoPlay loop style={{width:48,height:48,marginRight:12}}/>
          <Text style={styles.ctaTxt}>
            So many places to visit!{'\n'}Where to start?
          </Text>
        </View>

        {/* message list */}
        <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={{paddingBottom:8}}>
          {messages.map((msg,i)=>(
            <View key={i} style={styles.userBubble}>
              <Text style={styles.bubbleTxt}>{msg}</Text>
            </View>
          ))}
        </ScrollView>

        {/* prompt row */}
        <View style={styles.promptRow}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={onSend}
            multiline
            placeholder="Mmm, I'm thinking of coffee…"
            placeholderTextColor="#888"
            style={styles.promptInput}/>
          <Pressable onPress={onSend} style={styles.sendBtn}>
            <Feather name="send" size={18} color="#fff"/>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── styles ─────────────────────────── */
const STATUS=Platform.OS==='android'?StatusBar.currentHeight??24:0;
const styles=StyleSheet.create({
  map:{ flex:1 },
  dot:{ width:18,height:18,borderRadius:9,backgroundColor:'#fff' },
  userPin:{ padding:10,borderRadius:28,backgroundColor:'#000',
    justifyContent:'center',alignItems:'center' },

  sheet:{ position:'absolute',left:0,right:0,bottom:0,
    backgroundColor:'#fff',borderTopLeftRadius:16,borderTopRightRadius:16,
    padding:16,elevation:8,shadowColor:'#000',shadowOpacity:0.25,
    shadowRadius:6,shadowOffset:{ width:0,height:-3 }},
  handle:{ width:40,height:4,borderRadius:2,backgroundColor:'#ccc',
    alignSelf:'center',marginBottom:12 },

  ctaRow:{ flexDirection:'row',alignItems:'center' },
  ctaTxt:{ fontFamily:'Raleway_500Medium',fontSize:20,lineHeight:24,color:'#333' },

  chat:{ marginTop:12, maxHeight:200 },
  userBubble:{ alignSelf:'flex-end', backgroundColor:'#333',
    borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginVertical:4, maxWidth:'80%' },
  bubbleTxt:{ fontFamily:'Raleway_500Medium', color:'#fff', fontSize:16 },

  promptRow:{ flexDirection:'row', alignItems:'flex-end',
    borderWidth:1, borderColor:'#ddd', borderRadius:12,
    backgroundColor:'#fafafa', paddingHorizontal:10, paddingVertical:8, marginTop:12 },
  promptInput:{ flex:1, fontSize:16, fontFamily:'Raleway_500Medium',
    paddingRight:8, maxHeight:120 },
  sendBtn:{ backgroundColor:'#333', borderRadius:20,
    width:34, height:34, justifyContent:'center', alignItems:'center', marginBottom:2 },

  loader:{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#fff' },
});
