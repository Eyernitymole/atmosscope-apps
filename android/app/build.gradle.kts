plugins {
    id("com.android.application")
}

android {
    namespace = "com.atmosscope.weather"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.atmosscope.weather"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.environmentVariable("ANDROID_VERSION_CODE").orElse("1").get().toInt()
        versionName = providers.environmentVariable("APP_VERSION").orElse("1.1.0").get()
    }

    signingConfigs {
        create("release") {
            val keyStorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH")
            if (keyStorePath.isPresent) {
                storeFile = file(keyStorePath.get())
                storePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    sourceSets {
        getByName("main").assets.srcDir(rootProject.file("../web"))
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
