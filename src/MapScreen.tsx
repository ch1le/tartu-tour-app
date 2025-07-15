/********************************************************************
 * MapScreen.tsx — fullscreen map (v7.1, counts‑sorted)
 *  • Main & secondary tag pills include POI counts.
 *  • Secondary tags are sorted by count (highest first).
 *******************************************************************/
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import data from '../content.json';

/* ─ constants ─ */
const USER = { lat: 39.48605, lon: -0.360325 };
const WIDTH_METERS = 700;
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

/* ─ visual toggle ─ */
const CARD_ACCENT_BG = true;   // false → transparent icon + tag chips

const MAIN_CATS = [
  'All',
  'Culture',
  'Food',
  'History',
  'Local Commerce',
  'Nature',
] as const;
type MainCat = (typeof MAIN_CATS)[number];

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Culture: 'camera',
  Food: 'coffee',
  History: 'book-open',
  'Local Commerce': 'shopping-bag',
  Nature: 'leaf',
};

const SECONDARY: Record<Exclude<MainCat, 'All'>, string[]> = {
  Culture: [
    'Activism','Alternative','Architecture','Art','Collaborative','Community','Creative','Curious','Dance','Diversity','Education','Educational','Empowering','Events','Gender','Inclusive','Innovation','Interactive','Jazz','Kids','LGBTQIA+','Literature','Local Lore','Modern','Music','Nightlife','Performance','Photography','Playful','Quirky','Reflective','Retro','Science','Social','Socio‑political','Spiritual','Tradition','True Crime','Workshops',
  ],
  Food: ['Bakery','Desserts','Food','Friendly','Markets','Tapas','Wine'],
  History: ['Architecture','Heritage','Local Lore','Reflective','Retro','Tradition','True Crime','Vintage'],
  'Local Commerce': ['Artisan','Fashion','Markets','Professional','Streetwear','Thrift','Upcycling','Vintage'],
  Nature: ['Active','Adventurous','Chill','Cycling','Eco','Fitness','Hiking','Meditation','Open Air','Relaxing','Sustainability','Urban Exploration','Wellness'],
};

type Poi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: Exclude<MainCat, 'All'>;
  desc?: string;
  tags: string[];
};

/* ─ helpers ─ */
const m2lonDeg = (m:number, lat:number)=> m/(111_320*Math.cos((lat*Math.PI)/180));
const finite = (p:{lat:number;lon:number})=> Number.isFinite(p.lat)&&Number.isFinite(p.lon);

const POIS: Poi[] = (data.targets as any[]).map((t:any,idx:number)=>({
  id:`${t.lat},${t.lon},${idx}`,
  name:t.name,
  lat:t.lat,
  lon:t.lon,
  category:(Array.isArray(t.categories)&&t.categories[0]?t.categories[0]:'Culture') as Poi['category'],
  desc:t.desc,
  tags:Array.isArray(t.tags)?t.tags:[],
})).filter(finite);

const computeTargetRegion = ():Region=>{
  const lonDelta=m2lonDeg(WIDTH_METERS,USER.lat);
  return {
    latitude:USER.lat,
    longitude:USER.lon,
    latitudeDelta:lonDelta*(SCREEN_H/SCREEN_W),
    longitudeDelta:lonDelta,
  };
};

/* ─ main category counts (static) ─ */
const MAIN_COUNTS: Record<Exclude<MainCat,'All'>,number> = (()=> {
  const obj:any={};
  MAIN_CATS.forEach(c=>{ if(c!=='All') obj[c]=0; });
  POIS.forEach(p=>{ obj[p.category] += 1; });
  return obj;
})();

/* ─ Marker ─ */
const DotMarker = memo(({poi,selected,onPress}:{poi:Poi;selected:boolean;onPress:()=>void})=>{
  const [tracks,setTracks]=useState(true);
  useEffect(()=>{setTracks(true);const id=setTimeout(()=>setTracks(false),300);return()=>clearTimeout(id);},[selected]);
  const icon=CATEGORY_ICONS[poi.category];
  return(
    <Marker coordinate={{latitude:poi.lat,longitude:poi.lon}} title={poi.name} tracksViewChanges={tracks} onPress={onPress}>
      {selected
        ? <View style={styles.pinSelected}><Feather name={icon} size={18} color="#fff"/></View>
        : <View style={styles.pinSmall}><Feather name={icon} size={14} color="#333"/></View>}
    </Marker>
  );
});

/* ─ component ─ */
export default function MapScreen(){
  const mapRef=useRef<MapView>(null);
  const [mainCat,setMainCat]=useState<MainCat>('All');
  const [subTag,setSubTag]=useState<string|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);

  useEffect(()=>setSubTag(null),[mainCat]);

  const [startRegion,targetRegion]=useMemo(()=>{
    const trg=computeTargetRegion();
    return [{...trg,latitudeDelta:trg.latitudeDelta*5,longitudeDelta:trg.longitudeDelta*5},trg];
  },[]);

  /* visible POIs */
  const visible=useMemo(()=>POIS.filter(p=>{
    if(mainCat!=='All'&&p.category!==mainCat) return false;
    if(subTag&&!p.tags.includes(subTag)) return false;
    return true;
  }),[mainCat,subTag]);

  /* dynamic secondary counts */
  const secondaryCounts = useMemo(()=>{
    const map:Record<string,number>={};
    if(mainCat==='All') return map;
    POIS.filter(p=>p.category===mainCat).forEach(p=>{
      p.tags.forEach(tag=>{ map[tag]=(map[tag]||0)+1;});
    });
    return map;
  },[mainCat]);

  /* sorted secondary tags */
  const secondarySorted = useMemo(()=>{
    if(mainCat==='All') return [];
    return [...SECONDARY[mainCat]].sort(
      (a,b)=>(secondaryCounts[b]??0)-(secondaryCounts[a]??0)
    );
  },[mainCat,secondaryCounts]);

  /* keep selection valid */
  useEffect(()=>{ if(selectedId&&!visible.find(p=>p.id===selectedId)) setSelectedId(null);},[visible,selectedId]);
  const selectedPoi=useMemo(()=>visible.find(p=>p.id===selectedId)||null,[selectedId,visible]);

  const tagExtraSpace = selectedPoi ? 0 : 32;

  return(
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={startRegion}
        onMapReady={()=>mapRef.current?.animateToRegion(targetRegion,1200)}
        onPress={()=>setSelectedId(null)}
      >
        {visible.map(p=>(
          <DotMarker key={p.id} poi={p} selected={p.id===selectedId} onPress={()=>setSelectedId(p.id)}/>
        ))}
        <Marker coordinate={{latitude:USER.lat,longitude:USER.lon}} title="You are here" tracksViewChanges={false} zIndex={999}>
          <View style={styles.userPin}><Feather name="flag" size={18} color="#fff"/></View>
        </Marker>
      </MapView>

      {/* Bottom panel */}
      <View style={styles.bottomPanel} pointerEvents="box-none">
        {/* Tag bars */}
        <View pointerEvents="auto" style={{ marginBottom: tagExtraSpace }}>
          {/* Main tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll} style={styles.mainBar}>
            {MAIN_CATS.map(cat=>{
              const sel=cat===mainCat;
              const count = cat==='All' ? POIS.length : MAIN_COUNTS[cat as Exclude<MainCat,'All'>];
              return(
                <Pressable key={cat} style={[styles.tagPill,sel&&styles.tagSel]} onPress={()=>setMainCat(cat)}>
                  <Text style={[styles.tagTxt,sel&&styles.tagSelTxt]}>{cat} ({count})</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {/* Secondary tags */}
          {mainCat!=='All'&&(
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll} style={styles.subBar}>
              {secondarySorted.map(tag=>{
                const sel=tag===subTag;
                const count=secondaryCounts[tag]??0;
                return(
                  <Pressable key={tag} style={[styles.tagPill,sel&&styles.tagSel]} onPress={()=>setSubTag(sel?null:tag)}>
                    <Text style={[styles.tagTxt,sel&&styles.tagSelTxt]}>{tag} ({count})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Info card */}
        {selectedPoi&&(
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={()=>setSelectedId(null)}/>
            <View style={styles.cardWrapper}>
              <View style={styles.cardHeaderRow}>
                <View style={[
                  styles.cardIconBox,
                  !CARD_ACCENT_BG && { backgroundColor:'transparent' },
                ]}>
                  <Feather name={CATEGORY_ICONS[selectedPoi.category]} size={20} color="#333"/>
                </View>
                <Text style={styles.cardTitle}>{selectedPoi.name}</Text>
              </View>
              {selectedPoi.tags.length>0&&(
                <View style={styles.cardTagRow}>
                  {selectedPoi.tags.map(t=>(
                    <View key={t} style={[
                      styles.cardTagPill,
                      !CARD_ACCENT_BG && { backgroundColor:'transparent' },
                    ]}>
                      <Text style={styles.cardTagTxt}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
              <ScrollView style={styles.descScroll} contentContainerStyle={{paddingBottom:8}}>
                <Text style={styles.cardDesc}>{selectedPoi.desc||'No description provided.'}</Text>
              </ScrollView>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/* ─ styles ─ */
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' },

  pinSmall:{ width:22,height:22,borderRadius:11,backgroundColor:'#fff',justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:'#333' },
  pinSelected:{ width:30,height:30,borderRadius:15,backgroundColor:'#000',justifyContent:'center',alignItems:'center',borderWidth:2,borderColor:'#000' },
  userPin:{ width:30,height:30,borderRadius:15,backgroundColor:'#333',borderWidth:2,borderColor:'#333',justifyContent:'center',alignItems:'center' },

  bottomPanel:{ position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:12,pointerEvents:'box-none' },
  tagScroll:{ paddingHorizontal:12 },
  mainBar:{ marginBottom:4 },
  subBar:{ marginBottom:8 },
  tagPill:{ backgroundColor:'#f0f0f0',borderRadius:16,paddingHorizontal:14,paddingVertical:6,marginRight:10,marginBottom:4 },
  tagSel:{ backgroundColor:'#333' },
  tagTxt:{ fontSize:14,color:'#333' },
  tagSelTxt:{ color:'#fff' },

  cardWrapper:{ marginTop:8,maxHeight:SCREEN_H*0.5,backgroundColor:'#fff',borderTopLeftRadius:16,borderTopRightRadius:16,padding:16,elevation:8,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:10,shadowOffset:{ width:0,height:-3 } },
  cardHeaderRow:{ flexDirection:'row',alignItems:'center',marginBottom:8 },
  cardIconBox:{ width:28,height:28,borderRadius:14,backgroundColor:'#eee',justifyContent:'center',alignItems:'center',marginRight:8 },
  cardTitle:{ fontSize:18,fontWeight:'600',color:'#333',flexShrink:1 },
  cardTagRow:{ flexDirection:'row',flexWrap:'wrap',marginBottom:8 },
  cardTagPill:{ backgroundColor:'#eee',borderRadius:12,paddingHorizontal:10,paddingVertical:4,marginRight:6,marginBottom:6 },
  cardTagTxt:{ fontSize:12,color:'#333' },
  descScroll:{ flexGrow:0 },
  cardDesc:{ fontSize:14,lineHeight:20,color:'#555' },
});
