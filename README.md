# React Native Architecture — Guia Prático

Projeto didático para entender, de forma simples e na prática, a **Nova Arquitetura do React Native** (Fabric, TurboModules, JSI, Hermes) — comparada com a **arquitetura antiga** baseada na Bridge.

> Este README é o material de estudo. O app é apenas um suporte visual para fixar os conceitos. Os botões de cada tela disparam código que ilustra um ponto específico explicado abaixo.

---

## Sumário

1. [Como rodar](#como-rodar)
2. [Por que essa arquitetura existe](#por-que-essa-arquitetura-existe)
3. [Arquitetura antiga (Bridge + Paper)](#arquitetura-antiga-bridge--paper)
4. [Nova arquitetura: visão geral](#nova-arquitetura-visão-geral)
5. [JSI — JavaScript Interface](#jsi--javascript-interface)
6. [Fabric — o novo renderer](#fabric--o-novo-renderer)
7. [TurboModules e Codegen](#turbomodules-e-codegen)
8. [Thread Model](#thread-model)
9. [Hermes](#hermes)
10. [Tradeoffs](#tradeoffs)
11. [Alternativas no ecossistema](#alternativas-no-ecossistema)
12. [Roteiro de estudo sugerido](#roteiro-de-estudo-sugerido)
13. [Referências](#referências)

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

| Peça             | Antes                  | Agora                                |
| ---------------- | ---------------------- | ------------------------------------ |
| Comunicação JS↔nativo | Bridge (JSON async) | **JSI** (referências C++ diretas)   |
| Módulos nativos  | NativeModules (eager) | **TurboModules** (lazy + tipados)    |
| Renderer         | Paper (assíncrono)     | **Fabric** (Shadow Tree em C++)      |
| Tipagem          | Manual, propensa a erro | **Codegen** a partir de specs TS    |

Resultado prático:
- Chamadas síncronas viáveis (com critério).
- Startup mais rápido (módulos só carregam quando usados).
- Erros de tipagem detectados no build, não em produção.
- Layout que pode ser síncrono quando o JS precisa do tamanho.

---

## JSI — JavaScript Interface

JSI é uma **API C++ enxuta** que abstrai o runtime de JavaScript (Hermes, JSC, V8). Em vez de o JS mandar mensagens serializadas para o nativo, **um objeto C++ é exposto como propriedade no global do JS**. Chamar `MyModule.add(1,2)` vira invocação de função C++ direto.

Implicações:
- Não tem serialização JSON intermediária.
- Permite chamadas síncronas (a função roda na JS thread).
- Permite "Host Objects" — objetos JS cujas propriedades são respondidas por C++ on demand.
- É a base de tudo: Fabric, TurboModules e bibliotecas como Reanimated 3 usam JSI por baixo.

JSI **não é mágica** — uma chamada síncrona pesada ainda bloqueia a JS thread. A vantagem é poder *escolher* síncrono ou assíncrono.

---

## Fabric — o novo renderer

Fabric substitui o Paper. O coração dele é uma **Shadow Tree em C++** que vive próxima ao runtime JS via JSI.

Pipeline aproximado:
1. JSX reconciliado pelo React (como sempre).
2. A reconciliação aplica **mutações na Shadow Tree em C++** via JSI (sem JSON).
3. **Yoga** calcula layout em C++ (na thread de background).
4. Um **commit** atômico é feito.
5. O **mount** aplica a árvore na UI thread, criando/atualizando as views nativas (UIView/Android.View).

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

| Thread             | Quem mora aqui                       | Bloqueia o quê?                                        |
| ------------------ | ------------------------------------ | ------------------------------------------------------ |
| **JS thread**      | Seu código JS, Hermes, reconciliação | Atualizações de state, callbacks de evento             |
| **UI/Main thread** | Renderização nativa, eventos do SO   | Frames; se bloqueada, app trava visualmente            |
| **Shadow/Bg**      | Fabric C++, Yoga, codegen runtime    | Layout; bloqueá-la atrasa o commit                     |

Pontos práticos:
- **`useNativeDriver: true`** (Animated) executa a animação na UI thread — ela continua suave mesmo se o JS travar. Veja a tela "Thread Model" no app: o botão "Travar JS por 2s" demonstra que a bolinha não pára de animar.
- **Reanimated 3** vai além: executa "worklets" JS direto na UI thread via JSI.
- **TurboModules síncronos** rodam na JS thread (não usam fila assíncrona). Útil para coisas baratas; ruim para coisas pesadas.
- **TurboModules assíncronos** podem despachar para Executors (Android) ou GCD (iOS) e devolver via Promise.

---

## Hermes

Hermes é o engine JavaScript otimizado para mobile da Meta. Características:

- **Compila para bytecode** (HBC) no build, evitando parse de JS no boot.
- **Startup mais rápido** e uso de memória menor que JSC.
- **Sem JIT** (por design — startup determinístico, sem warm-up).
- Suporte completo a debugger via Chrome DevTools / Flipper.
- **Padrão** desde RN 0.70+.

Hermes integra com a Nova Arquitetura via JSI — todas as chamadas C++/JSI funcionam transparentemente em cima dele.

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

| Solução           | Modelo                                  | Quando faz sentido                                    |
| ----------------- | --------------------------------------- | ----------------------------------------------------- |
| **Flutter**       | UI própria (Skia/Impeller), Dart        | Quer máximo controle visual, time não-React           |
| **Native (Swift / Kotlin)** | UI nativa pura                  | App muito específico de plataforma, time nativo forte |
| **Kotlin Multiplatform** | Lógica compartilhada, UI nativa  | Quer compartilhar só negócio, UI nativa por OS        |
| **Capacitor / Ionic** | WebView com pontes nativas          | Reaproveitar app web, performance secundária          |
| **NativeScript**  | UI nativa via JS, sem React (ou com Vue/Angular) | Stack JS sem investir em React              |
| **Tauri Mobile**  | WebView + Rust no backend (beta)        | Time Rust, app simples                                |

Dentro do mundo React Native:
- **Expo** — toolchain por cima do RN; suporta a Nova Arquitetura via dev client a partir do SDK 51.
- **Brownfield integration** — RN embarcado em apps nativos existentes, simplificado pela Nova Arquitetura.
- **React Native Skia / Reanimated / Gesture Handler** — bibliotecas que tiram proveito direto de JSI/Fabric para coisas que antes seriam impraticáveis em RN.

---

## Roteiro de estudo sugerido

Ordem que normalmente funciona bem para internalizar o assunto:

1. **Conceito de Bridge** (arquitetura antiga). Entenda por que ela limitava o RN.
2. **JSI**. O que é, por que é fundacional. Leia a [introdução oficial à Nova Arquitetura](https://reactnative.dev/architecture/landing-page).
3. **Hermes**. Como engine afeta startup e memória.
4. **Fabric**. Shadow Tree, Yoga, fases (render/commit/mount).
5. **TurboModules + Codegen**. Construa um do zero, como o `Calculator` deste projeto.
6. **Thread model**. Brinque com `useNativeDriver` e bloqueio intencional da JS thread.
7. **Reanimated 3 / Skia / Gesture Handler**. Onde JSI brilha em libs reais.
8. **Migração e interop**. Como apps grandes migram aos poucos.

Exercícios práticos:
- Adicione um método novo ao `Calculator` (ex: `divideAsync` rejeitando promise em divisão por zero).
- Crie um TurboModule novo expondo, por exemplo, info do device (`getDeviceName`).
- Suba um componente Fabric customizado (`HostComponent`) — mais avançado, exige codegen para componentes.

---

## Referências

Oficial / canônico:
- [Nova Arquitetura — visão geral](https://reactnative.dev/architecture/landing-page)
- [TurboModules — introdução](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [Fabric — renderer](https://reactnative.dev/architecture/fabric-renderer)
- [JSI — explicação técnica](https://reactnative.dev/architecture/glossary#javascript-interfaces-jsi)
- [Codegen para TurboModules](https://reactnative.dev/docs/the-new-architecture/using-codegen)
- [Hermes](https://reactnative.dev/docs/hermes)

Aprofundamento:
- Posts do blog oficial do React Native sobre cada release (0.68→0.85), que vão revelando peças da nova arquitetura.
- [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/) — uso real de JSI/UI thread.
- [Expo + New Architecture](https://docs.expo.dev/guides/new-architecture/) — se preferir começar pelo Expo.
- Talks da React Conf e App.js Conf são ótimas para fixar mental model.

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
