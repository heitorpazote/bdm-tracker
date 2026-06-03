# Cripto Tracker — App Android (WebView)

Wrapper nativo Android que carrega a SPA do Cripto Tracker (`../index.html` + `../js/`) dentro de uma `WebView`. Nenhum código do app web é modificado — uma task Gradle (`syncWebAssets`) copia automaticamente os arquivos para `app/src/main/assets/web/` a cada build.

## Estrutura

```
arquivos_apk/
├─ build.gradle.kts            # plugins raiz
├─ settings.gradle.kts         # nome + módulos
├─ gradle.properties
├─ gradle/wrapper/             # versão do Gradle (8.7)
└─ app/
   ├─ build.gradle.kts         # AGP, deps, task syncWebAssets
   ├─ proguard-rules.pro
   └─ src/main/
      ├─ AndroidManifest.xml
      ├─ java/com/criptotracker/app/
      │  ├─ CriptoTrackerApp.kt     # Application (debug remoto)
      │  └─ MainActivity.kt         # WebView + back handler
      └─ res/                       # layout, theme, ícone, XML config
```

## Como abrir e compilar

1. **Abrir no Android Studio** (Hedgehog 2023.1.1 ou mais novo):
   - `File → Open` → selecione a pasta `arquivos_apk/`.
   - O Studio baixa Gradle 8.7 + AGP 8.4 + SDK 34 automaticamente.

2. **Gerar APK debug** (linha de comando, dentro de `arquivos_apk/`):
   ```powershell
   .\gradlew.bat assembleDebug
   ```
   APK em `app/build/outputs/apk/debug/app-debug.apk`.

3. **Rodar no emulador / dispositivo**:
   ```powershell
   .\gradlew.bat installDebug
   ```

> O wrapper (`gradlew`/`gradlew.bat`) ainda **não está commitado** porque o Android Studio o cria na primeira sincronização. Se preferir gerar manualmente: `gradle wrapper --gradle-version 8.7` dentro da pasta.

## Como funciona a sincronização de assets

A task `syncWebAssets` (em `app/build.gradle.kts`) executa antes de `mergeXxxAssets` e copia:

- `../index.html` → `app/src/main/assets/web/index.html`
- `../js/**`     → `app/src/main/assets/web/js/**`

A `MainActivity` carrega `file:///android_asset/web/index.html`. Como o destino é ignorado pelo Git (veja `.gitignore`), nunca vai dessincronizar.

## Comportamento da WebView

- JavaScript, DOM Storage e IndexedDB habilitados (necessário para persistência local e para o Supabase JS).
- Cookies (incluindo de terceiros) habilitados — sessão Supabase precisa.
- Misto bloqueado (`MIXED_CONTENT_NEVER_ALLOW`) — o app usa HTTPS.
- Algorithmic Darkening em API ≥ 29 para coexistir com o tema escuro da SPA.
- Botão "voltar" do Android navega no histórico da WebView; ao chegar na raiz, fecha o app.
- `setWebContentsDebuggingEnabled(true)` em debug → inspecione via `chrome://inspect`.
- Links externos (não Supabase / não CDNs do app) abrem no navegador padrão via `Intent.ACTION_VIEW`.

## Permissões

- `INTERNET` e `ACCESS_NETWORK_STATE` — Supabase + CDNs (Tailwind, Google Fonts).

## Identificadores

- `applicationId` / `namespace`: `com.criptotracker.app`
- `versionCode`: 1, `versionName`: 1.0.0
- `minSdk`: 24 (Android 7.0), `targetSdk`/`compileSdk`: 34 (Android 14)

Edite em `app/build.gradle.kts` antes de publicar.

## Próximos passos sugeridos

- Adicionar splash screen via [Splash Screen API](https://developer.android.com/develop/ui/views/launch/splash-screen).
- Criar variantes (`flavorDimensions`) para apontar a WebView para staging vs produção, se houver.
- Configurar assinatura release em `signingConfigs` para gerar AAB de Play Store.
