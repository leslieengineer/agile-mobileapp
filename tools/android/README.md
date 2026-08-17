# Pinned Matter Android controller

`build-chip-controller.sh` builds the Android controller Java/JNI artifacts from ConnectedHomeIP commit `93abd8e6891bb578ea63254fb29d099936f345c8`, the commit pinned by the firmware's esp-matter checkout.

Required Linux/WSL toolchain follows the pinned ConnectedHomeIP documentation:

- Android SDK platform 34
- Android NDK 28.2.13676358
- JDK 17
- Kotlin compiler 2.1.10
- arm64-v8a target

Run inside WSL after setting `ANDROID_HOME`, `ANDROID_NDK_HOME`, and `JAVA_HOME`. Pass a staging directory outside the Git worktree. The output contains controller JARs, JNI libraries, and `SHA256SUMS`. No generated binary is committed to this repository.

The mobile Gradle integration must fail closed when the staging directory or checksum manifest is absent. Do not substitute artifacts built from ConnectedHomeIP `master` or another esp-matter release.
