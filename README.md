# AtmosScope Apps

This repository contains small native shells for the public AtmosScope weather PWA.

## Supported platforms

- Android 7.0+ (`com.atmosscope.weather`) via Trusted Web Activity.
- Windows 10/11 x64 via WPF and the Evergreen WebView2 Runtime.

The weather application and all weather data logic remain at:
`https://atmosscope-weather.phillipchan520.chatgpt.site`.

## Local checks

```bash
npm test
```

Android release signing is supplied only through CI environment variables. Never commit a keystore or password.
