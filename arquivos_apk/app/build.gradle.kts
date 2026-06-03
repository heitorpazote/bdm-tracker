import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.criptotracker.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.criptotracker.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
}

// =====================================================================
// Sincroniza index.html e a pasta js/ do projeto raiz para src/main/assets
// antes de cada build. Mantem a fonte unica de verdade no projeto web.
// =====================================================================
val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    val projectWebRoot = rootProject.projectDir.parentFile
    val destination = layout.projectDirectory.dir("src/main/assets/web")

    from(projectWebRoot) {
        include("index.html")
        include("js/**")
    }
    into(destination)

    // Evita falha caso a estrutura mude. Logga arquivos copiados.
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
    doFirst {
        println("[syncWebAssets] copiando de ${projectWebRoot.absolutePath} para ${destination.asFile.absolutePath}")
    }
}

androidComponents {
    onVariants { variant ->
        // Garante que o Sync rode antes do merge de assets de cada variante.
        afterEvaluate {
            tasks.named("merge${variant.name.replaceFirstChar { it.uppercase() }}Assets").configure {
                dependsOn(syncWebAssets)
            }
        }
    }
}
