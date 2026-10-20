plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Номер сборки задаёт CI (-PversionCode=N), по нему приложение узнаёт о новых версиях
val buildNumber = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1

android {
    namespace = "by.mtbank.mobyfamily"
    compileSdk = 35

    defaultConfig {
        applicationId = "by.mtbank.mobyfamily"
        minSdk = 24
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
        // Откуда приложение берёт обновления (GitHub Releases этого репозитория)
        buildConfigField("String", "UPDATE_REPO", "\"kvasiuum/hackatonmtbank\"")
    }

    // Демо-ключ лежит в репозитории, чтобы все сборки были подписаны одинаково
    // и новая версия ставилась поверх старой. Для продакшена ключ хранится в секретах CI.
    signingConfigs {
        create("demo") {
            storeFile = file("demo-keystore.jks")
            storePassword = "mobyfamily"
            keyAlias = "mobyfamily"
            keyPassword = "mobyfamily"
        }
    }
    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("demo") }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("demo")
        }
    }

    // Веб-модуль собирается в /docs (npm run build:pages) и кладётся в APK как есть
    sourceSets["main"].assets.srcDirs("../../docs")

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
}
