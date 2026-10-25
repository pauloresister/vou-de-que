# API do Vou de Quê?

O servidor tem duas partes, ambas no plano gratuito do Supabase:

- A **Edge Function `api`** faz a comparação de trajetos, a busca de endereços e devolve os preços de referência.
- O **banco** guarda os alertas colaborativos e entrega as novidades em tempo real.

Respostas da função são JSON. Erros vêm sempre como `{ "error": "mensagem em português" }`.

## Edge Function

Base: `https://SEU-PROJETO.supabase.co/functions/v1/api`. Envie o cabeçalho `apikey` com a chave pública. Se a chave for do formato antigo (começa com `eyJ`), envie também `Authorization: Bearer <chave>`.

### GET /health
```json
{ "ok": true, "carTraffic": "tempo_real", "time": "2026-10-25T15:00:00.000Z" }
```
`carTraffic` é `estimado` quando não há `TOMTOM_API_KEY` configurada.

### GET /places/search?q=&lat=&lng=
Autocompletar (Photon). `q` com 2 a 120 caracteres. `lat` e `lng` são opcionais e priorizam resultados próximos.
```json
{ "places": [{ "id": "N123", "name": "MASP", "address": "Avenida Paulista, 1578, Bela Vista, São Paulo, São Paulo", "lat": -23.5614, "lng": -46.6559 }] }
```

### GET /places/reverse?lat=&lng=
Endereço legível de uma coordenada. Resposta: `{ "place": Place | null }`.

### GET /reference/prices?uf=SP
Combustível (ANP) e tarifas de referência.
```json
{
  "uf": "SP",
  "fuel": { "gasolina": 6.53, "etanol": 3.86, "diesel": 7.0 },
  "fuelReference": "ANP, Levantamento de Preços de Combustíveis, semana de 11 a 17/10/2026",
  "fuelUpdatedAt": "2026-10-17",
  "fares": { "bus": 5.3, "rail": 5.4, "integrated": 9.38 },
  "faresReference": "SPTrans e Governo de SP, valores vigentes desde 06/01/2026"
}
```
Para atualizar os valores, edite `supabase/functions/_shared/pricing.ts`.

### POST /compare
Corpo:
```json
{
  "origin": { "lat": -23.5614, "lng": -46.6559 },
  "destination": { "lat": -23.5874, "lng": -46.6576 },
  "vehicle": { "consumptionKmL": 11, "fuelPrice": 6.53, "parkingCost": 0 },
  "fares": { "bus": 5.3, "rail": 5.4, "integrated": 9.38 },
  "valueOfTimePerHour": 25
}
```
Resposta (resumida):
```json
{
  "car": {
    "available": true, "distanceKm": 4.8, "durationMin": 22, "freeFlowMin": 13, "reportedDelayMin": 0,
    "trafficLevel": "intenso", "fuelLiters": 0.44, "fuelCost": 2.85, "parkingCost": 0, "cost": 2.85,
    "source": "tempo_real", "provider": "TomTom Traffic", "polyline": [[-23.5614, -46.6559]], "incidents": []
  },
  "transit": {
    "available": true, "durationMin": 28, "walkMin": 9, "waitMin": 4, "inVehicleMin": 15, "reportedDelayMin": 0,
    "transfers": 0, "cost": 5.3, "fareRule": "Tarifa de ônibus", "modeLabel": "ônibus",
    "legs": [
      { "mode": "walk", "durationMin": 5, "toName": "Av. Paulista" },
      { "mode": "bus", "line": "875A-10", "headsign": "Perdizes", "durationMin": 15, "departure": "2026-10-25T15:09:00Z", "realTime": false },
      { "mode": "walk", "durationMin": 4 }
    ],
    "crowding": { "level": "moderado", "line": "875A-10", "reports": 3, "lastReportAt": "2026-10-25T14:58:00Z" },
    "lineAlerts": [], "source": "horario", "provider": "Transitous (horários oficiais GTFS)", "polyline": []
  },
  "recommendation": {
    "best": "car", "fastest": "car", "cheapest": "car", "timeSavedMin": 6, "moneySaved": 2.45, "closeCall": false,
    "headline": "Vá de carro",
    "summary": "De carro você chega 6 min antes e ainda gasta R$ 2,45 a menos. No coletivo, a linha está com lotação moderada. O trânsito está intenso no caminho de carro.",
    "scores": { "car": 12.82, "transit": 22.17 }
  },
  "generatedAt": "2026-10-25T15:05:00.000Z"
}
```
O campo `source` diz de onde veio cada tempo:
- `tempo_real`: trânsito ao vivo, ou coletivo com dados em tempo real da operadora.
- `horario`: horários oficiais publicados pela operadora.
- `estimado`: estimativa pelo horário do dia e pela distância.

Em `recommendation`, `fastest` e `cheapest` ficam `null` em caso de empate.

## Banco (alertas colaborativos)

O app usa o cliente oficial do Supabase com a chave pública. As regras de permissão são:
- O app pode **ler** os alertas ativos.
- O app pode **executar** as três funções abaixo.
- Gravar direto na tabela é bloqueado.
- A autoria fica numa tabela privada, só como hash do aparelho.

### rpc `alerts_near(p_lat, p_lng, p_radius_km = 10)`
Retorna os alertas ativos no raio pedido, entre 0,5 e 50 km, do mais recente para o mais antigo (máximo de 200).

### rpc `create_alert(p_kind, p_lat, p_lng, p_device_id, p_crowd_level, p_incident_type, p_line, p_note)`
- `p_kind`: `lotacao` ou `ocorrencia`.
- Lotação exige `p_crowd_level` (`vazio`, `moderado` ou `lotado`) e `p_line`.
- Ocorrência exige `p_incident_type` (`transito_parado`, `acidente` ou `atraso_linha`). O tipo `atraso_linha` também exige `p_line`.
- Validade: lotação 30 minutos, ocorrência 60.
- Limites: recusa alerta igual do mesmo aparelho em menos de 5 minutos e aceita no máximo 12 alertas por aparelho por hora.
- Mensagens de erro vêm em português.

### rpc `confirm_alert(p_alert_id, p_device_id)`
"Ainda está assim". Aceita um voto por aparelho, e quem criou o alerta não pode votar. Cada voto prolonga a validade em 10 minutos, até o limite do tipo.

### Tempo real
Assine `postgres_changes` na tabela `public.alerts`. O evento `INSERT` traz alerta novo, `UPDATE` traz uma confirmação e `DELETE` indica a remoção de um alerta vencido. A remoção acontece a cada 10 minutos, via pg_cron.
