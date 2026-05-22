# React Native Architecture — Guia Prático

Projeto didático para entender, de forma simples e na prática, a **Nova Arquitetura do React Native** (Fabric, TurboModules, JSI, Hermes) — comparada com a **arquitetura antiga** baseada na Bridge.

> Este README é o material de estudo. O app é apenas um suporte visual para fixar os conceitos. Os botões de cada tela disparam código que ilustra um ponto específico explicado abaixo.

---

## Sumário

1. [Como rodar](#como-rodar)
2. [Diagrama geral — arquitetura antiga vs nova](#diagrama-geral--arquitetura-antiga-vs-nova)
3. [Por que essa arquitetura existe](#por-que-essa-arquitetura-existe)
4. [Arquitetura antiga (Bridge + Paper)](#arquitetura-antiga-bridge--paper)
5. [Nova arquitetura: visão geral](#nova-arquitetura-visão-geral)
6. [JSI — JavaScript Interface](#jsi--javascript-interface)
7. [Fabric — o novo renderer](#fabric--o-novo-renderer)
8. [TurboModules e Codegen](#turbomodules-e-codegen)
9. [Thread Model](#thread-model)
10. [Hermes vs JSC](#hermes-vs-jsc)
11. [Metro Bundler e Fast Refresh](#metro-bundler-e-fast-refresh)
12. [Concurrent React no mobile](#concurrent-react-no-mobile)
13. [Reanimated 3 — JSI na prática](#reanimated-3--jsi-na-prática)
14. [Interop Layer — migração incremental](#interop-layer--migração-incremental)
15. [Tradeoffs](#tradeoffs)
16. [Alternativas no ecossistema](#alternativas-no-ecossistema)
17. [Fluxo completo: toque → setState](#fluxo-completo-toque--setstate)
18. [Roteiro de estudo sugerido](#roteiro-de-estudo-sugerido)
19. [Referências](#referências)

---

## Como rodar

Pré-requisitos (instale o que faltar):

- Node ≥ 22.11
- Watchman (recomendado)
- **iOS**: Xcode completo (não só CLI tools), CocoaPods (`bundle install` no diretório `ios/`), Ruby gerenciado por rbenv ou similar
- **Android**: Android Studio + SDK, JDK 17+, `ANDROID_HOME` configurado

```bash
# 1) instalar dependências
npm install

# 2) iOS (gera AppSpecs via codegen no pod install)
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios

# 3) Android (codegen roda como parte do gradle build)
npm run android
```

Se o build falhar, geralmente é o codegen que precisa rodar:

```bash
# Android
cd android && ./gradlew generateCodegenArtifactsFromSchema && cd ..

# iOS — basta refazer pod install
cd ios && bundle exec pod install && cd ..
```

A Nova Arquitetura já vem **habilitada por padrão** a partir do React Native 0.76. Não precisa de flag.

---

## Diagrama geral — arquitetura antiga vs nova

### Arquitetura antiga (até RN 0.68)

```
╔══════════════════════════════════════════════════════════════════════╗
║                        ARQUITETURA ANTIGA                            ║
╠══════════════════╦═══════════════════════╦═══════════════════════════╣
║   JS THREAD      ║       BRIDGE          ║    NATIVE (UI THREAD)     ║
║                  ║                       ║                           ║
║  ┌────────────┐  ║  ┌─────────────────┐  ║  ┌─────────────────────┐ ║
║  │  Seu       │  ║  │  Serializa JSON │  ║  │  Paper Renderer     │ ║
║  │  código JS │──╬─►│  (batch, async) │──╬─►│  (cria UIViews)     │ ║
║  │  + React   │  ║  │                 │  ║  │                     │ ║
║  └────────────┘  ║  │  Fila de        │  ║  │  NativeModules      │ ║
║        │         ║  │  mensagens      │◄─╬──│  (eager, todos      │ ║
║  ┌─────▼──────┐  ║  │                 │  ║  │   no startup)       │ ║
║  │  JSC/      │  ║  └─────────────────┘  ║  └─────────────────────┘ ║
║  │  JavaScr.  │  ║                       ║                           ║
║  │  Core      │  ║  ⚠ Tudo assíncrono    ║  ┌─────────────────────┐ ║
║  └────────────┘  ║  ⚠ Cópia JSON a       ║  │  Yoga Layout        │ ║
║                  ║    cada chamada       ║  │  (outra thread)     │ ║
║                  ║  ⚠ Sem tipos          ║  └─────────────────────┘ ║
╚══════════════════╩═══════════════════════╩═══════════════════════════╝

Fluxo de uma chamada nativa:
  JS chama módulo → serializa para JSON → enfileira na Bridge →
  nativo deserializa → executa → serializa resposta →
  Bridge → JS deserializa → callback
  (mínimo: 2 serializações + 1 round-trip assíncrono)
```

### Nova Arquitetura (RN 0.76+ padrão)

```
╔══════════════════════════════════════════════════════════════════════╗
║                         NOVA ARQUITETURA                             ║
╠══════════════════╦═══════════════════════╦═══════════════════════════╣
║   JS THREAD      ║    JSI (C++ direto)   ║    NATIVE (UI THREAD)     ║
║                  ║                       ║                           ║
║  ┌────────────┐  ║  ┌─────────────────┐  ║  ┌─────────────────────┐ ║
║  │  Seu       │  ║  │  Host Objects   │  ║  │  Fabric Renderer    │ ║
║  │  código JS │──╬─►│  (ref. C++ no   │  ║  │                     │ ║
║  │  + React   │  ║  │   global do JS) │  ║  │  Recebe commits     │ ║
║  └────────────┘  ║  │                 │  ║  │  atômicos da        │ ║
║        │         ║  │  Sem serializ.  │  ║  │  Shadow Tree        │ ║
║  ┌─────▼──────┐  ║  │  Pode ser sync  │──╬─►│                     │ ║
║  │  Hermes    │  ║  └─────────────────┘  ║  └─────────────────────┘ ║
║  │  (bytecode,│  ║                       ║                           ║
║  │  sem JIT)  │  ║  ┌─────────────────┐  ║  ┌─────────────────────┐ ║
║  └────────────┘  ║  │  TurboModules   │  ║  │  TurboModules       │ ║
║                  ║  │  (lazy, tipados │◄─╬──│  nativos            │ ║
║                  ║  │   via codegen)  │  ║  │  (iOS/Android)      │ ║
║                  ║  └─────────────────┘  ║  └─────────────────────┘ ║
╠══════════════════╩═══════════════════════╩═══════════════════════════╣
║                   BACKGROUND / SHADOW THREAD                         ║
║                                                                      ║
║   ┌──────────────────────────────────────────────────────────────┐   ║
║   │  Shadow Tree (C++)  ──►  Yoga Layout  ──►  Commit atômico   │   ║
║   └──────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════╝

Fluxo de uma chamada nativa:
  JS acessa objeto C++ no global → invoca função → resultado retorna
  (0 serializações, pode ser síncrono)
```

### Comparação direta

```
                    ANTIGA                    NOVA
                    ──────                    ────
Comunicação:        Bridge (JSON async)       JSI (C++ direto)
Renderer:           Paper                     Fabric
Módulos nativos:    NativeModules (eager)     TurboModules (lazy)
Tipagem:            Nenhuma em runtime        Codegen (build time)
Startup:            Carrega tudo              Carrega só o necessário
Layout sync:        Impossível               Possível via JSI
Engine JS padrão:   JSC                       Hermes
```

---

## Por que essa arquitetura existe

O React Native original (2015) provou que dava para usar React fora do navegador, mas o modelo de comunicação tinha limites duros:

- **Assíncrono por natureza**: toda chamada JS↔nativo passava por uma Bridge serializando JSON em batches. Mesmo coisas triviais (medir uma view, ler uma constante) eram assíncronas.
- **Sem segurança de tipos** entre JS e nativo: tudo era JSON livre. Erros só apareciam em runtime.
- **Startup pesado**: todos os módulos nativos eram instanciados no boot, mesmo os que o app nunca usaria.
- **Animações dependiam de pular a Bridge** (`useNativeDriver`) para serem suaves — sintoma de que o caminho normal era lento demais.

A Nova Arquitetura ataca esses problemas trocando o protocolo de comunicação (Bridge → JSI), o renderer (Paper → Fabric) e o modelo de módulos nativos (NativeModules → TurboModules), com **codegen** garantindo contratos tipados.

---

## Arquitetura antiga (Bridge + Paper)

```
┌────────────┐   JSON batched, async   ┌─────────────┐
│ JS thread  │  ───────────────────►   │  Native side│
│ (JSC/Herm.)│  ◄───────────────────   │ (iOS/Andr.) │
└────────────┘                          └─────────────┘
       │
       └── Paper renderer cria operações de UI ──► serializa ──► Bridge ──► UI thread
```

Características:
- **Bridge**: fila de mensagens JSON entre JS e nativo. Tudo assíncrono.
- **Paper renderer**: gera "diffs" de UI e envia comandos serializados para a UI thread aplicar.
- **NativeModules**: registrados de forma eager; o JS chama por nome (string), recebe Promise.
- **Animated sem `useNativeDriver`** ficava preso no JS — atravessar a Bridge por frame era impossível em 60fps.

Limitações que ainda eram aceitáveis até deixarem de ser:
- Layout síncrono é impossível: `measure()` é callback porque o Yoga roda do outro lado da Bridge.
- Não dá para integrar React em código nativo existente sem virar a hierarquia de pernas pro ar.
- Tooling de tipos: tudo string + JSON. Refatoração quebra silenciosamente.

---

## Nova arquitetura: visão geral

Três pilares novos e um habilitador transversal:

| Peça                  | Antes                    | Agora                             |
| --------------------- | ------------------------ | --------------------------------- |
| Comunicação JS↔nativo | Bridge (JSON async)      | **JSI** (referências C++ diretas) |
| Módulos nativos       | NativeModules (eager)    | **TurboModules** (lazy + tipados) |
| Renderer              | Paper (assíncrono)       | **Fabric** (Shadow Tree em C++)   |
| Tipagem               | Manual, propensa a erro  | **Codegen** a partir de specs TS  |

Resultado prático:
- Chamadas síncronas viáveis (com critério).
- Startup mais rápido (módulos só carregam quando usados).
- Erros de tipagem detectados no build, não em produção.
- Layout que pode ser síncrono quando o JS precisa do tamanho.

---

## JSI — JavaScript Interface

JSI é uma **API C++ enxuta** que abstrai o runtime de JavaScript (Hermes, JSC, V8). Em vez de o JS mandar mensagens serializadas para o nativo, **um objeto C++ é exposto como propriedade no global do JS**. Chamar `MyModule.add(1,2)` vira invocação de função C++ direto.

```
Antes (Bridge):
  JS: "Calculator.add(1, 2)"
      → serializa: {"module":"Calculator","method":"add","args":[1,2]}
      → enfileira na Bridge
      → nativo deserializa e executa
      → serializa resposta: {"result":3}
      → Bridge devolve ao JS
      → JS deserializa e chama callback
             ↑ mínimo 2 cópias + 1 round-trip assíncrono

Agora (JSI):
  JS: NativeCalculator.add(1, 2)   ← objeto C++ vive no global do JS
      → C++ executa diretamente
      → retorna 3
             ↑ zero serialização, pode ser síncrono
```

Implicações:
- Não tem serialização JSON intermediária.
- Permite chamadas síncronas (a função roda na JS thread).
- Permite "Host Objects" — objetos JS cujas propriedades são respondidas por C++ on demand.
- É a base de tudo: Fabric, TurboModules e bibliotecas como Reanimated 3 usam JSI por baixo.

JSI **não é mágica** — uma chamada síncrona pesada ainda bloqueia a JS thread. A vantagem é poder *escolher* síncrono ou assíncrono.

---

## Fabric — o novo renderer

Fabric substitui o Paper. O coração dele é uma **Shadow Tree em C++** que vive próxima ao runtime JS via JSI.

```
  JSX no seu componente
         │
         ▼
  React reconcilia (diff)
         │
         ▼
  Mutações na Shadow Tree (C++, via JSI)  ◄── sem JSON aqui
         │
         ▼
  Yoga calcula layout (background thread)
         │
         ▼
  Commit atômico  ◄── "fotografia" imutável da UI
         │
         ▼
  Mount na UI thread  ──► UIView (iOS) / View (Android)
```

Por que isso importa na prática:
- **Sync layout**: o JS pode pedir medida e receber resposta sem callback.
- **Concorrência React real**: o commit é atômico — combina bem com Suspense, transitions, etc.
- **Menos cópias**: a representação da UI é uma só, compartilhada entre JS e nativo.
- **Host Components tipados**: componentes nativos têm contrato gerado por codegen.

Veja a tela "Fabric Renderer" no app: cada `View`, `TextInput`, `Switch` é uma view nativa montada por esse pipeline.

---

## TurboModules e Codegen

Um **TurboModule** é a versão Nova Arquitetura de um NativeModule. Três mudanças importantes:

1. **Spec em TypeScript** descreve o contrato ([src/specs/NativeCalculator.ts](src/specs/NativeCalculator.ts) aqui no projeto).
2. **Codegen** lê a spec no build e gera:
   - No Android: uma classe abstrata Java (`NativeCalculatorSpec`) que a sua classe Kotlin estende.
   - No iOS: um protocol Objective-C (`NativeCalculatorSpec`) e structs C++ para constantes.
3. **Acesso via JSI**: o módulo é exposto ao JS através do `TurboModuleRegistry`, sem string-based lookup pela Bridge.

```
  NativeCalculator.ts (sua spec TS)
         │
         ▼  BUILD TIME
  Codegen
    ├──► NativeCalculatorSpec.java / .kt  (Android)
    └──► NativeCalculatorSpec.h / .mm     (iOS)
         │
         ▼  RUNTIME
  CalculatorModule.kt / Calculator.mm  (sua implementação)
         │
         ▼
  TurboModuleRegistry (via JSI)
         │
         ▼
  JS acessa direto, sem string lookup, sem Bridge
```

Lazy loading: o módulo só é instanciado quando o JS chama pela primeira vez — startup mais leve.

### O TurboModule deste projeto

- Spec: [src/specs/NativeCalculator.ts](src/specs/NativeCalculator.ts)
- Config: [`codegenConfig`](package.json) no package.json
- Android: [CalculatorModule.kt](android/app/src/main/java/com/rnarchdemo/calculator/CalculatorModule.kt), [CalculatorPackage.kt](android/app/src/main/java/com/rnarchdemo/calculator/CalculatorPackage.kt), registrado em [MainApplication.kt](android/app/src/main/java/com/rnarchdemo/MainApplication.kt)
- iOS: [Calculator.h](ios/RNArchDemo/Calculator.h), [Calculator.mm](ios/RNArchDemo/Calculator.mm)

A tela "TurboModule" no app exercita:
- `add(a,b)` — **síncrono**, retorna `number` direto.
- `multiplyAsync(a,b)` — **assíncrono**, despacha para outra thread no nativo e resolve uma Promise.
- `getConstants()` — constantes vindas do nativo, **lazy** (no NativeModules antigo, eram eagerly enviadas no boot).

---

## Thread Model

Pelo menos três threads relevantes convivem:

```
┌─────────────────────────────────────────────────────────────────┐
│                        THREADS EM PARALELO                       │
├──────────────────┬──────────────────┬───────────────────────────┤
│   JS THREAD      │   UI THREAD      │   BACKGROUND THREAD       │
│                  │   (Main)         │   (Shadow)                │
│  • Seu código JS │  • Frames 60fps  │  • Fabric C++             │
│  • React recon.  │  • Gestos        │  • Yoga layout            │
│  • TurboModules  │  • Animações     │  • Commits                │
│    síncronos     │    nativas       │                           │
│                  │                  │                           │
│  Se travar:      │  Se travar:      │  Se travar:               │
│  setState pausa, │  App congela     │  Layout atrasado          │
│  callbacks param │  visualmente     │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
```

Pontos práticos:
- **`useNativeDriver: true`** (Animated) executa a animação na UI thread — ela continua suave mesmo se o JS travar. Veja a tela "Thread Model" no app: o botão "Travar JS por 2s" demonstra que a bolinha não pára de animar.
- **Reanimated 3** vai além: executa "worklets" JS direto na UI thread via JSI.
- **TurboModules síncronos** rodam na JS thread (não usam fila assíncrona). Útil para coisas baratas; ruim para coisas pesadas.
- **TurboModules assíncronos** podem despachar para Executors (Android) ou GCD (iOS) e devolver via Promise.

---

## Hermes vs JSC

Hermes é o engine JavaScript criado pela Meta especificamente para mobile. Antes dele, o RN usava **JavaScriptCore (JSC)** — o mesmo engine do Safari.

```
                   JSC                       HERMES
                   ───                       ──────
Parse do JS:       Em runtime (no boot)      Em build (gera bytecode .hbc)
JIT:               Sim                       Não (deliberado)
Startup:           Mais lento               Mais rápido
Memória:           Maior                    Menor
Startup previsível: Não (depende do JIT)    Sim (bytecode pré-compilado)
Debugging:         Chrome DevTools          Chrome DevTools + Flipper
Padrão no RN:      Até 0.69                 0.70+
```

**Por que sem JIT?**
JIT (Just-In-Time compilation) acelera código quente depois de rodar algumas vezes — ótimo para servidores de longa duração. Em apps mobile, o usuário já fechou o app antes do JIT aquecer. O Hermes troca JIT por bytecode pré-compilado: o código chega "aquecido" desde o primeiro frame.

Hermes integra com a Nova Arquitetura via JSI — todas as chamadas C++/JSI funcionam transparentemente em cima dele.

---

## Metro Bundler e Fast Refresh

**Metro** é o bundler JavaScript do React Native (equivalente ao Webpack/Vite no mundo web). Ele roda em background durante o desenvolvimento (`npm start`).

```
  Seus arquivos .tsx/.ts
         │
         ▼
  Metro Bundler
    ├── resolve imports
    ├── transpila TypeScript → JS
    ├── aplica Babel transforms
    └── gera bundle JS
         │
         ▼  DEV
  Servidor HTTP local  ──► app faz download do bundle via rede
         │
         ▼  PROD
  Bundle empacotado no .apk / .ipa  (via hermes: compila para .hbc)
```

**Fast Refresh** é o mecanismo que atualiza o componente que você editou sem perder o estado dos outros componentes. É diferente do "hot reload" antigo (que reiniciava tudo) e do "live reload" (que também reiniciava).

Como funciona por baixo:
1. Metro detecta mudança no arquivo.
2. Envia apenas o módulo atualizado ao app via WebSocket.
3. O runtime React substitui o componente em memória.
4. Estado local de componentes não editados é preservado.

Limitação: se você editar um módulo não-componente (utilitário, hook de estado global), o Fast Refresh reinicia o app inteiro para garantir consistência.

---

## Concurrent React no mobile

O React 18 introduziu o **modo concorrente** — a capacidade do React de pausar e retomar o trabalho de renderização. No mobile, isso importa porque:

- **Transitions** (`useTransition`): marcam uma atualização como "não urgente". O React pode interromper a renderização dela se chegar uma atualização mais urgente (ex: um toque do usuário).
- **Suspense** (`<Suspense fallback={...}>`): permite aguardar dados sem bloquear a UI.
- **`startTransition`**: mantém a UI responsiva enquanto uma tela pesada carrega.

```
  Sem modo concorrente:
    usuário digita → React renderiza tela inteira → UI trava por 200ms

  Com modo concorrente:
    usuário digita → React começa a renderizar (baixa prioridade)
                   → usuário digita mais → React PAUSA a renderização anterior
                   → processa o novo caractere (alta prioridade)
                   → retoma a renderização pesada depois
```

O Fabric foi desenhado para suportar isso: o **commit atômico** significa que uma "rascunho" de renderização pode ser descartado sem nunca ter chegado à UI thread — algo impossível com o Paper assíncrono da arquitetura antiga.

---

## Reanimated 3 — JSI na prática

O Reanimated 3 é a demonstração mais visível do poder do JSI no mundo real. Ele permite que você escreva código JavaScript que roda diretamente na **UI thread**, sem passar pelo JS thread a cada frame.

```
  Animação sem Reanimated (JS Animated):
    UI thread renderiza frame ──► pede valor ao JS ──► aguarda ──► recebe ──► renderiza
    (cada frame atravessa a Bridge/JSI ida e volta)

  Animação com Reanimated 3 (worklets):
    UI thread renderiza frame ──► executa worklet direto ──► renderiza
    (JS fica fora do caminho crítico)
```

**Worklets** são funções JS especiais marcadas com `'worklet'` que o Reanimated copia para a UI thread via JSI. Elas têm acesso a valores animados (`useSharedValue`) mas rodam em paralelo ao JS thread normal.

```typescript
const offset = useSharedValue(0);

const animatedStyle = useAnimatedStyle(() => {
  'worklet'; // essa função roda na UI thread, não no JS
  return { transform: [{ translateX: offset.value }] };
});
```

Isso é o que permite animações a 120fps em ProMotion sem engolir a JS thread — algo impossível com a arquitetura antiga.

---

## Interop Layer — migração incremental

Quando a Nova Arquitetura foi habilitada por padrão no RN 0.76, a maior preocupação era: "e as centenas de bibliotecas que ainda usam a Bridge antiga?". A resposta é a **Interop Layer**.

```
  Nova Arquitetura (Fabric + JSI)
         │
         ▼
  Interop Layer  ◄── camada de compatibilidade
         │
         ▼
  Biblioteca legada (usa Bridge / Paper / NativeModules antigos)
```

Como funciona:
- **Para componentes UI**: o Fabric tem um modo de compatibilidade que envolve componentes Paper antigos em um wrapper Fabric.
- **Para módulos nativos**: o TurboModuleRegistry consegue acessar NativeModules legados como se fossem TurboModules (com custo de performance, mas sem quebrar).

Isso permite que apps grandes migrem assim:
1. Ativa Nova Arquitetura (RN 0.76+).
2. App continua funcionando — bibliotecas legadas rodam via interop.
3. Ao longo do tempo, substitui por versões nativas da Nova Arquitetura.
4. Remove a interop layer quando não precisar mais.

O custo da interop é real: você paga parte do overhead da Bridge onde ela ainda está ativa. Mas é muito melhor do que uma reescrita big-bang.

---

## Tradeoffs

### Ganhos
- Performance percebida melhor (startup, animações, layout).
- Contratos tipados ponta a ponta.
- Pipeline mais previsível e debugável (commits atômicos do Fabric).
- Permite recursos avançados do React (Suspense, transições) funcionarem direito.

### Custos
- **Complexidade de build**: codegen, Pods, gradle plugins, mais peças móveis.
- **Curva de aprendizado**: precisa entender Shadow Tree, JSI, código C++/Obj-C++ para módulos mais sofisticados.
- **Compatibilidade**: bibliotecas antigas podem precisar de wrappers de interop (a Nova Arquitetura mantém compatibilidade via *interop layer*, mas com custo).
- **Debug nativo é mais "C++"**: stack traces atravessam camadas adicionais.
- **Tooling ainda amadurecendo** em alguns nichos (alguns mocks de teste, algumas bibliotecas legadas).

### Quando vale o trade
Para apps novos a partir de 2025, é o caminho default — não há ganho real em começar na arquitetura antiga. Para apps grandes em produção, a migração geralmente é incremental: ativa Fabric, migra módulos críticos para TurboModules, depende do interop para o resto.

---

## Alternativas no ecossistema

Não confunda "alternativa ao Fabric" com "alternativa ao React Native". As principais opções fora do RN:

| Solução                    | Modelo                                         | Quando faz sentido                          |
| -------------------------- | ---------------------------------------------- | ------------------------------------------- |
| **Flutter**                | UI própria (Skia/Impeller), Dart               | Quer máximo controle visual, time não-React |
| **Native (Swift/Kotlin)**  | UI nativa pura                                 | App muito específico de plataforma          |
| **Kotlin Multiplatform**   | Lógica compartilhada, UI nativa                | Quer compartilhar só negócio, UI nativa     |
| **Capacitor / Ionic**      | WebView com pontes nativas                     | Reaproveitar app web, performance secundária|
| **NativeScript**           | UI nativa via JS, sem React                    | Stack JS sem investir em React              |
| **Tauri Mobile**           | WebView + Rust no backend (beta)               | Time Rust, app simples                      |

Dentro do mundo React Native:
- **Expo** — toolchain por cima do RN; suporta a Nova Arquitetura via dev client a partir do SDK 51.
- **Brownfield integration** — RN embarcado em apps nativos existentes, simplificado pela Nova Arquitetura.
- **React Native Skia / Reanimated / Gesture Handler** — bibliotecas que tiram proveito direto de JSI/Fabric.

---

## Fluxo completo: toque → setState

Este é o exercício mental mais útil para fixar tudo. Quando o usuário toca um botão que chama `setState`, o que acontece passo a passo:

```
  USUÁRIO TOCA A TELA
         │
         ▼
  [UI THREAD] Sistema operacional detecta o toque
         │
         ▼
  [UI THREAD] Gesture responder do RN processa o evento
         │
         ▼  via JSI (Nova Arq.) ou Bridge serializada (antiga)
  [JS THREAD] Seu handler onPress() é chamado
         │
         ▼
  [JS THREAD] setState({ contador: contador + 1 })
         │
         ▼
  [JS THREAD] React agenda re-renderização
              (modo concorrente: pode ser interrompida se chegar
               algo mais urgente)
         │
         ▼
  [JS THREAD] React reconcilia — gera diff da árvore de componentes
         │
         ▼
  [BACKGROUND] Fabric recebe mutações na Shadow Tree (via JSI)
         │
         ▼
  [BACKGROUND] Yoga recalcula layout se necessário
         │
         ▼
  [BACKGROUND] Commit: "fotografia" imutável da nova UI é criada
         │
         ▼
  [UI THREAD] Mount: commit é aplicado
              ├── UIView existentes são atualizadas
              ├── novas UIViews são criadas
              └── UIViews removidas são destruídas
         │
         ▼
  PRÓXIMO FRAME É RENDERIZADO COM O NOVO ESTADO
```

Na **arquitetura antiga**, cada seta que cruza threads passava pela Bridge com serialização JSON. Na **Nova Arquitetura**, as setas que cruzam JS ↔ nativo passam pelo JSI sem cópia.

---

## Roteiro de estudo sugerido

### Fase 1 — Fundamentos do RN (antes de ir para arquitetura)

1. Como o **Metro Bundler** funciona e o que ele gera.
2. Ciclo de vida de componentes RN vs React web — o que é diferente.
3. **StyleSheet e Yoga** — como o layout RN difere do CSS.
4. Crie um **NativeModule simples** na arquitetura antiga (só para sentir o problema).

### Fase 2 — Nova Arquitetura

5. **JSI** — o que é, por que é fundacional.
6. **Hermes** — como engine afeta startup e memória.
7. **Fabric** — Shadow Tree, Yoga, fases (render/commit/mount).
8. **TurboModules + Codegen** — construa um do zero (como o `Calculator` deste projeto).
9. **Thread model** — bloqueio intencional da JS thread (tela Threading no app).

### Fase 3 — JSI na prática e migração

10. **Reanimated 3** — worklets, useSharedValue, useAnimatedStyle.
11. **Concurrent React** — useTransition, Suspense no mobile.
12. **Interop Layer** — como apps grandes migram aos poucos.

### Exercícios para quem vai explicar

- Desenhe o diagrama completo do fluxo "toque → setState" sem consultar nada.
- Explique a diferença entre Bridge e JSI para alguém usando uma analogia do dia a dia.
- Crie um segundo TurboModule (`getDeviceName` ou `divideAsync` com rejeição).
- Substitua o `Animated` da tela Threading por Reanimated 3.

---

## Referências

Oficial / canônico:
- [Nova Arquitetura — visão geral](https://reactnative.dev/architecture/landing-page)
- [TurboModules — introdução](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [Fabric — renderer](https://reactnative.dev/architecture/fabric-renderer)
- [JSI — explicação técnica](https://reactnative.dev/architecture/glossary#javascript-interfaces-jsi)
- [Codegen para TurboModules](https://reactnative.dev/docs/the-new-architecture/using-codegen)
- [Hermes](https://reactnative.dev/docs/hermes)
- [Metro Bundler](https://metrobundler.dev)

Aprofundamento:
- Posts do blog oficial do React Native sobre cada release (0.68→0.85).
- [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/) — uso real de JSI/UI thread.
- [Expo + New Architecture](https://docs.expo.dev/guides/new-architecture/).
- Talks da React Conf e App.js Conf — ótimas para fixar mental model.

---

## Estrutura do projeto

```
.
├── App.tsx                       # roteador minimalista entre telas
├── src/
│   ├── components/               # InfoCard, ScreenHeader
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── FabricDemoScreen.tsx
│   │   ├── TurboModuleDemoScreen.tsx
│   │   └── ThreadingDemoScreen.tsx
│   └── specs/
│       └── NativeCalculator.ts   # spec do TurboModule (fonte do codegen)
├── android/app/src/main/java/com/rnarchdemo/
│   ├── MainApplication.kt        # registra CalculatorPackage
│   └── calculator/
│       ├── CalculatorModule.kt   # implementa NativeCalculatorSpec gerado
│       └── CalculatorPackage.kt  # BaseReactPackage lazy
├── ios/RNArchDemo/
│   ├── AppDelegate.swift
│   ├── Calculator.h              # adota NativeCalculatorSpec gerado
│   └── Calculator.mm             # implementação Obj-C++
└── package.json                  # codegenConfig aponta para src/specs
```
