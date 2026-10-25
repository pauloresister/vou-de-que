import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { CompareResult } from '@/lib/types';
import { palette, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

/**
 * Mapa com MapLibre GL JS + OpenFreeMap (dados do OpenStreetMap) dentro de uma WebView.
 * OpenFreeMap é gratuito, sem chave, sem cadastro e sem limite de visualizações.
 * Não exige SDK nativo de mapas, então compila igual em Android e iOS.
 */
export function RouteMap({
  result,
  origin,
  destination,
}: {
  result: CompareResult;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}) {
  const t = useTheme();
  const html = useMemo(
    () =>
      buildHtml({
        car: result.car.polyline,
        transit: result.transit.polyline,
        o: [origin.lat, origin.lng],
        d: [destination.lat, destination.lng],
        dark: t.dark,
        bg: t.surfaceAlt,
        transitColor: t.transit,
      }),
    [result, origin.lat, origin.lng, destination.lat, destination.lng, t.dark, t.surfaceAlt, t.transit],
  );

  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.frame, { borderColor: t.border, backgroundColor: t.surfaceAlt }]}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={{ backgroundColor: 'transparent' }}
          nestedScrollEnabled
          setSupportMultipleWindows={false}
          javaScriptEnabled
          accessibilityLabel="Mapa com os trajetos de carro e de transporte público"
        />
      </View>
      <View style={styles.legend}>
        <View style={styles.item}>
          <View style={[styles.lineCar]} />
          <AppText variant="small" color={t.textMuted}>
            Carro
          </AppText>
        </View>
        {result.transit.polyline.length > 0 ? (
          <View style={styles.item}>
            <View style={[styles.lineTransit, { backgroundColor: t.transit }]} />
            <AppText variant="small" color={t.textMuted}>
              Transporte público
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.0/dist';

function buildHtml(d: {
  car: [number, number][];
  transit: [number, number][];
  o: [number, number];
  d: [number, number];
  dark: boolean;
  bg: string;
  transitColor: string;
}) {
  const style = `https://tiles.openfreemap.org/styles/${d.dark ? 'dark' : 'positron'}`;
  const fallbackStyle = 'https://tiles.openfreemap.org/styles/positron';
  // GeoJSON usa [lng, lat]; o app trafega [lat, lng].
  const toLngLat = (pts: [number, number][]) => pts.map(([lat, lng]) => [lng, lat]);
  const data = { car: toLngLat(d.car), transit: toLngLat(d.transit), o: [d.o[1], d.o[0]], d: [d.d[1], d.d[0]] };
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css"/>
<style>html,body,#m{height:100%;margin:0;background:${d.bg}}.maplibregl-ctrl-attrib{font-size:10px}</style>
</head><body><div id="m"></div>
<script src="${MAPLIBRE}/maplibre-gl.js"></script>
<script>
var D=${JSON.stringify(data)};
var all=[D.o,D.d].concat(D.car,D.transit);
var b=all.reduce(function(acc,p){return [[Math.min(acc[0][0],p[0]),Math.min(acc[0][1],p[1])],[Math.max(acc[1][0],p[0]),Math.max(acc[1][1],p[1])]];},[[180,90],[-180,-90]]);
var map=new maplibregl.Map({container:'m',style:'${style}',bounds:b,fitBoundsOptions:{padding:32},
  attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false});
map.touchZoomRotate.disableRotation();
var switched=false;
map.on('error',function(){ if(!switched && '${style}'!=='${fallbackStyle}'){ switched=true; map.setStyle('${fallbackStyle}'); } });
function line(id,coords,paint){ if(!coords.length||map.getSource(id)) return;
  map.addSource(id,{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:coords}}});
  map.addLayer({id:id,type:'line',source:id,layout:{'line-cap':'butt','line-join':'round'},paint:paint}); }
function point(id,c,paint){ if(map.getSource(id)) return;
  map.addSource(id,{type:'geojson',data:{type:'Feature',geometry:{type:'Point',coordinates:c}}});
  map.addLayer({id:id,type:'circle',source:id,paint:paint}); }
map.on('style.load',function(){
  line('coletivo',D.transit,{'line-color':'${d.transitColor}','line-width':6,'line-opacity':0.95});
  line('carro-base',D.car,{'line-color':'${palette.asfalto}','line-width':9,'line-opacity':0.9});
  line('carro',D.car,{'line-color':'${palette.faixa}','line-width':4,'line-dasharray':[2,1.5]});
  point('origem',D.o,{'circle-radius':8,'circle-color':'#ffffff','circle-stroke-color':'${palette.asfalto}','circle-stroke-width':4});
  point('destino',D.d,{'circle-radius':9,'circle-color':'${palette.faixa}','circle-stroke-color':'${palette.asfalto}','circle-stroke-width':3});
});
</script></body></html>`;
}

const styles = StyleSheet.create({
  frame: { height: 260, borderRadius: radius.piece, overflow: 'hidden', borderWidth: 1 },
  legend: { flexDirection: 'row', gap: space.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineCar: { width: 22, height: 6, borderRadius: 2, backgroundColor: palette.faixa, borderWidth: 1.5, borderColor: palette.asfalto },
  lineTransit: { width: 22, height: 5, borderRadius: 2 },
});
