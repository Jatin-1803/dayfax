allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// package_info_plus is a transitive Android plugin (geolocator_linux). Its Kotlin
// classes compile, but AGP omits them from the library compile jar, so
// GeneratedPluginRegistrant cannot see PackageInfoPlugin.
subprojects {
    if (name != "package_info_plus") return@subprojects

    afterEvaluate {
        val kotlinSrc = file("src/main/kotlin")
        if (!kotlinSrc.isDirectory) return@afterEvaluate

        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            source(kotlinSrc)
        }
    }
}

subprojects {
    if (name != "app") return@subprojects

    tasks.withType<JavaCompile>().configureEach {
        val release = name.contains("Release", ignoreCase = true)
        val variant = if (release) "release" else "debug"
        val kotlinTask = if (release) {
            ":package_info_plus:compileReleaseKotlin"
        } else {
            ":package_info_plus:compileDebugKotlin"
        }
        dependsOn(kotlinTask)
        classpath += files(
            rootProject.layout.buildDirectory.dir("package_info_plus/tmp/kotlin-classes/$variant"),
        )
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
