# Vou de Quê?

Aplicativo que responde, para um trajeto de A até B, se agora compensa mais ir de carro ou de transporte público. Ele calcula os dois cenários ao mesmo tempo, soma caminhada, espera e trânsito, cruza com alertas enviados pelos próprios usuários e recomenda a melhor opção com uma frase direta:

> Ir de ônibus leva 15 min a mais, mas economiza R$ 21,45 e a linha está com lotação moderada.

**Custo total: R$ 0.** Nenhum serviço usado aqui pede cartão de crédito. Sem cartão cadastrado, nenhum deles tem como cobrar: se uma cota gratuita acabar, o serviço apenas recusa pedidos e o app passa automaticamente para estimativas, sem quebrar.

O projeto é de código aberto (licença MIT), condição do Transitous para uso gratuito da API de transporte público.

---

## 1. Justificativa técnica

### Serviços usados (todos gratuitos, nenhum pede cartão)

| Para quê | Serviço | Precisa de cadastro? | Limite gratuito | Se o limite acabar |
|---|---|---|---|---|
| Trânsito ao vivo (carro) | TomTom Routing API, plano Freemium | Sim, só e-mail | 2.500 rotas por dia | O app usa OSRM com tempo estimado pelo horário |
| Rota de carro sem chave | OSRM público (OpenStreetMap) | Não | Uso razoável | Comparação mostra só o coletivo |
| Ônibus, metrô e trem | Transitous (horários GTFS oficiais, inclui SPTrans) | Não | Uso razoável, projeto não comercial | O app estima pelo horário e distância |
| Busca de endereços | Photon (OpenStreetMap) | Não | Uso razoável | Mensagem clara e nova tentativa |
| Mapa | OpenFreeMap + MapLibre | Não | Sem limite | O mapa não aparece, o resto funciona |
| Banco, alertas ao vivo e servidor | Supabase, plano Free | Sim, login com GitHub | 500 mil chamadas de função por mês, 200 conexões ao vivo | O projeto pausa após 7 dias sem uso; o workflow incluso evita isso |
| Compilar o APK | GitHub Actions | Sim, conta GitHub | Ilimitado em repositório público | |
| Preço de combustível | Levantamento semanal da ANP (dados abertos) | Não | | |

O que ficou de fora e por quê: Google Maps exige cartão desde 2018. A HERE encerrou em 31/08/2025 seu plano sem cartão. A Render pode exigir cartão para verificar a conta. Expo EAS não é necessário, porque o APK é compilado no próprio GitHub.

### Stack

**App: React Native + Expo SDK 58 + TypeScript.** Um único código para Android e iOS, com componentes nativos. O projeto nativo é gerado na hora do build, o que permite compilar o APK direto no GitHub Actions sem Android Studio.

**Servidor: Supabase (PostgreSQL + Edge Function em Deno).** Substitui um servidor próprio, que exigiria hospedagem paga ou cartão:

- **Edge Function `api`.** Calcula a comparação, guarda a chave do TomTom longe do app e concentra o motor de decisão. Uma regra nova não exige publicar outra versão do app.
- **Funções SQL.** Criam, confirmam e buscam alertas com validação, antirrepetição e limite por hora. O app só usa a chave pública e não consegue gravar direto na tabela.
- **Realtime.** Entrega novos alertas a todos os aparelhos conectados no mesmo instante.

**Robustez.** Toda chamada externa tem tempo limite e uma alternativa:

- Se o TomTom falha, entra o OSRM.
- Se o Transitous não encontra rota, entra uma estimativa.
- Se o banco de alertas não responde, a comparação segue sem relatos.
- No app, cada tela tem tratamento de erro próprio e as buscas antigas de endereço são canceladas.
- A Edge Function tem 17 testes automatizados, que rodam a cada push. O SQL foi testado num PostgreSQL real.

### Conceito visual: "Sinalização Urbana"

A identidade sai da própria rua:

- **Cores:** asfalto (`#18212E`), o amarelo das faixas de rodovia para o carro (`#F5B700`) e o verde das linhas de ônibus para o coletivo (`#087F59`), sobre fundo cinza-claro frio (`#EDF0F3`).
- **Tipografia:** Barlow, desenhada a partir de placas de trânsito. O corpo de texto usa 17 pt e respeita o tamanho de fonte do sistema.
- **Pista do tempo:** é o elemento marcante. Cada opção vira uma faixa de asfalto proporcional ao tempo total. O carro é um tracejado amarelo; o coletivo aparece dividido em caminhada, espera e viagem a bordo. É o único movimento automático do app, e ele é desligado quando o aparelho pede movimento reduzido.
- **Comparativo:** um painel único dividido ao meio. A opção recomendada ganha uma faixa na sua cor.
- **Mapa:** usa o estilo do OpenFreeMap, claro ou escuro conforme o tema.
- **Ícone:** uma bifurcação, com a faixa tracejada amarela de um lado e a linha verde contínua do outro.

---

## 2. Como o sistema decide

**Carro.** `Custo = (Distância ÷ Consumo médio) × Preço do combustível`, mais estacionamento opcional. O tempo considera o trânsito do momento. O nível de trânsito é a razão entre tempo atual e tempo sem trânsito: abaixo de 1,2 é livre, até 1,5 é moderado, acima é intenso.

**Transporte público.** `Tempo total = caminhada + espera pelo próximo veículo + viagem a bordo`. A espera vem dos horários publicados pelas operadoras, ou de tempo real quando a operadora fornece. A tarifa segue o Bilhete Único: só ônibus paga uma tarifa, só trilhos paga uma tarifa, ônibus com trilhos paga a integração.

**Alertas colaborativos.**
- **Tipos:** lotação (vazio, moderado, lotado) informando a linha, válida por 30 minutos; e ocorrências (trânsito parado, acidente, atraso na linha), válidas por 60.
- **Confirmação:** o botão "Ainda está assim" prolonga a validade.
- **Peso dos relatos:** os mais recentes pesam mais.
- **Efeito no cálculo:** acidentes e trânsito parado a até 250 m da rota de carro somam atraso. Atrasos relatados na linha somam minutos ao coletivo.

**Motor de decisão.** Usa o custo generalizado, conceito clássico de economia dos transportes: `custo = dinheiro + tempo × valor da sua hora`.
- **Pesos de desconforto:** caminhar e esperar pesam 1,5×, viajar lotado 1,45×, trânsito intenso 1,1×.
- **Valor da hora:** padrão de R$ 25/h, ajustável no app.
- **Saída:** o selo Mais rápida (com minutos economizados), o selo Mais econômica (com o valor economizado), a recomendação e a frase de apoio.

---

## 3. Estrutura do repositório

```
vou-de-que/
├── README.md
├── LICENSE                          MIT (código aberto)
├── docs/API.md                      Referência da API e do banco
├── .github/workflows/
│   ├── supabase.yml                 Testa e publica banco + função no Supabase
│   ├── android-apk.yml              Compila o APK; publica em Releases nas tags v*
│   └── manter-ativo.yml             Evita a pausa do Supabase gratuito
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20261025000000_alertas.sql   Tabela, funções seguras, tempo real, limpeza
│   └── functions/
│       ├── api/index.ts             Ponto de entrada da Edge Function
│       ├── _shared/
│       │   ├── handler.ts           Rotas HTTP
│       │   ├── compare.ts           Os dois cenários em paralelo
│       │   ├── decision.ts          Motor de decisão e frase de resumo
│       │   ├── community.ts         Cruza alertas com a rota
│       │   ├── car.ts               TomTom (trânsito ao vivo) e OSRM
│       │   ├── transit.ts           Transitous, estimativa e tarifas
│       │   ├── geocoding.ts         Photon
│       │   ├── pricing.ts           Tabela ANP e tarifas
│       │   ├── alert-source.ts      Leitura dos alertas no banco
│       │   └── geo.ts, format.ts, http.ts, time.ts, schemas.ts, types.ts, config.ts
│       └── tests/                   17 testes (Deno)
└── mobile/
    ├── app.json, eas.json, .env.example
    ├── assets/                      Ícone, ícone adaptativo, splash
    ├── app/                         Telas: comparar, alertas, ajustes, reportar
    └── src/                         Tema, componentes, hooks, cliente Supabase
```

---

## 4. Passo a passo completo (sem gastar nada)

São três contas gratuitas: GitHub, Supabase e TomTom (esta opcional, mas recomendada). Reserve cerca de 40 minutos na primeira vez.

### Passo 1: subir o código para o GitHub
1. Crie uma conta em github.com.
2. Clique em **New repository**, dê o nome `vou-de-que`, marque **Public** (exigência do Transitous e garante Actions ilimitado) e crie sem README.
3. Na pasta `vou-de-que` descompactada, rode:
   ```bash
   git init
   git add .
   git commit -m "Vou de Quê? v1.0"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/vou-de-que.git
   git push -u origin main
   ```
   **Sem usar terminal:**
   1. Na página do repositório vazio, clique em **uploading an existing file**.
   2. Arraste o conteúdo da pasta, incluindo a pasta oculta `.github`.

### Passo 2: criar o projeto no Supabase
1. Entre em supabase.com e clique em **Start your project**, fazendo login com o GitHub.
2. Clique em **New project**, dê o nome `vou-de-que`, crie uma senha para o banco (guarde-a) e escolha a região **South America (São Paulo)**. O plano é o Free.
3. Quando o projeto ficar pronto, anote três dados:
   - **Project ref:** o código de 20 letras na URL do painel (`supabase.com/dashboard/project/ESTE-CODIGO`).
   - **Project URL:** em **Project Settings > API** (algo como `https://abcd...supabase.co`).
   - **Chave pública:** em **Project Settings > API Keys**, a chave **anon** ou **publishable**. Ela é pública por natureza; nunca use a chave `service_role` ou `secret` no app.
4. Crie um token de acesso em **Account > Access Tokens > Generate new token**.

### Passo 3: criar a chave gratuita do TomTom (recomendado)
1. Crie uma conta em developer.tomtom.com. Não é pedido cartão.
2. No painel, copie a **API Key** criada automaticamente.

Sem essa chave o app funciona igual, mas o tempo de carro passa a ser estimado pelo horário em vez de vir do trânsito ao vivo.

### Passo 4: guardar as configurações no GitHub
No repositório, vá em **Settings > Secrets and variables > Actions**.

Na aba **Secrets**, crie:

| Nome | Valor |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token do passo 2.4 |
| `SUPABASE_DB_PASSWORD` | Senha do banco do passo 2.2 |
| `TOMTOM_API_KEY` | Chave do passo 3 (opcional) |

Na aba **Variables**, crie:

| Nome | Valor |
|---|---|
| `SUPABASE_PROJECT_REF` | Project ref do passo 2.3 |
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL do passo 2.3 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do passo 2.3 |
| `APP_USER_AGENT` | `VouDeQue/1.0 (seu-email@exemplo.com)` (contato pedido por Transitous, Photon e OSRM) |

### Passo 5: publicar o servidor
1. Vá na aba **Actions** do repositório e, se pedido, autorize os workflows.
2. Escolha **Servidor (Supabase)** e clique em **Run workflow**. Em cerca de 3 minutos, ele testa o código, cria o banco e publica a função.
3. Para conferir, abra no navegador `https://SEU-PROJETO.supabase.co/functions/v1/api/health`. Deve aparecer `"ok": true`.

**Se a etapa "Criar ou atualizar o banco" falhar** (algumas redes não alcançam o banco diretamente), faça manualmente:
1. Abra no painel do Supabase o **SQL Editor**.
2. Cole o conteúdo de `supabase/migrations/20261025000000_alertas.sql` e clique em **Run**.
3. Rode o workflow de novo.

### Passo 6: gerar o APK
1. Em **Actions**, escolha **APK Android** e clique em **Run workflow**. A primeira compilação leva de 15 a 25 minutos.
2. Abra a execução concluída e baixe o artefato **vou-de-que-apk**.
3. Para ter uma página de download fixa, crie uma tag: `git tag v1.0.0 && git push --tags`. O APK aparece em **Releases**.

### Passo 7: instalar no celular Android
1. Envie o `vou-de-que.apk` para o celular.
2. Toque no arquivo e permita a instalação desta fonte.
3. Abra o **Vou de Quê?**, escolha origem e destino e toque em **Comparar agora**.

### Manutenção (também gratuita)
- **Pausa do Supabase:** o workflow **Manter servidor ativo** consulta o banco a cada 3 dias. O GitHub desliga workflows agendados após 60 dias sem commits no repositório; um commit qualquer, ou reativar na aba Actions, resolve. Se o projeto pausar mesmo assim, clique em **Restore** no painel do Supabase. A reativação é gratuita e os dados são mantidos.
- **Preços do combustível:** edite `supabase/functions/_shared/pricing.ts` com os valores da semana da ANP e faça commit. O workflow publica sozinho, sem nova versão do app.

---

## 5. Rodar no computador (opcional)

```bash
# Testes do servidor (requer Deno 2)
cd supabase/functions
deno test --allow-env --allow-net tests/

# App (requer Node.js 22)
cd mobile
cp .env.example .env          # preencha com os dados do Supabase
npm install
npx expo start                # escaneie o QR code com o app Expo Go
```

---

## 6. Problemas comuns

- **"O app foi compilado sem o endereço do servidor".** As variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` não estavam definidas no build. Configure o passo 4 e gere o APK de novo.
- **Aparece "trânsito estimado pelo horário".** Não há `TOMTOM_API_KEY`, ou a cota de 2.500 rotas do dia acabou. A cota reinicia no dia seguinte.
- **Aparece "tempo do coletivo estimado".** O Transitous não encontrou itinerário para o trajeto: a cidade pode não ter dados abertos ou o horário pode estar sem serviço. Em São Paulo, a rede de ônibus da SPTrans está coberta.
- **"O servidor gratuito está pausado".** Clique em **Restore** no painel do Supabase.
- **O build do APK reclama da versão do Java.** Em `android-apk.yml`, troque `java-version: 17` por `21`.

### Publicar na Play Store
O APK do GitHub Actions é assinado com a chave de testes do Android. Serve para instalar e distribuir diretamente, mas a Play Store recusa. Para publicar, gere um keystore próprio (gratuito, pela documentação oficial do React Native). A conta de desenvolvedor da Google Play cobra uma taxa única, então é o único passo deste projeto que não é gratuito.

---

## 7. Próximos passos sugeridos
- **Ônibus ao vivo em SP:** previsão de chegada em tempo real pela API Olho Vivo da SPTrans, que é gratuita com cadastro e sem cartão.
- **Combustível automático:** atualização da tabela da ANP a partir das planilhas semanais, por um workflow agendado.
- **Favoritos:** trajetos salvos para consulta rápida.
