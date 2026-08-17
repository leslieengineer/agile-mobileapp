#!/usr/bin/env bash
set -euo pipefail

CHIP_ROOT="${CHIP_ROOT:-/opt/esp/esp-matter/connectedhomeip/connectedhomeip}"
EXPECTED_SHA="93abd8e6891bb578ea63254fb29d099936f345c8"
STAGE_DIR="${1:-${HOME}/.cache/rhophi-chip-controller/93abd8e6/arm64-v8a}"

: "${ANDROID_HOME:?ANDROID_HOME must point to Android SDK 34}"
: "${ANDROID_NDK_HOME:?ANDROID_NDK_HOME must point to NDK 28.2.13676358}"
: "${JAVA_HOME:?JAVA_HOME must point to JDK 17}"

if [[ "$(git -C "${CHIP_ROOT}" rev-parse HEAD)" != "${EXPECTED_SHA}" ]]; then
    echo "ConnectedHomeIP must be pinned to ${EXPECTED_SHA}" >&2
    exit 2
fi
if [[ ! -d "${ANDROID_HOME}/platforms/android-34" ]]; then
    echo "Android platform 34 is not installed" >&2
    exit 2
fi
if [[ ! -d "${ANDROID_NDK_HOME}" ]]; then
    echo "Android NDK 28.2.13676358 is not installed" >&2
    exit 2
fi
if [[ ! -f "${CHIP_ROOT}/third_party/mbedtls/repo/library/aes.c" ||
      ! -f "${CHIP_ROOT}/third_party/perfetto/repo/sdk/perfetto.cc" ||
      ! -f "${CHIP_ROOT}/third_party/lwip/repo/src/include/lwip/init.h" ]]; then
    echo "ConnectedHomeIP Android submodules are incomplete; initialize the pinned checkout before building" >&2
    exit 2
fi

cd "${CHIP_ROOT}"
set +u
source scripts/activate.sh
set -u
./scripts/build/build_examples.py --target android-arm64-chip-tool build

OUT="${CHIP_ROOT}/out/android-arm64-chip-tool"
LIB="${OUT}/lib"
rm -rf "${STAGE_DIR}.tmp"
mkdir -p "${STAGE_DIR}.tmp/jars" "${STAGE_DIR}.tmp/jni/arm64-v8a"
for jar in CHIPController CHIPInteractionModel libMatterTlv AndroidPlatform OnboardingPayload CHIPClusters CHIPClusterID; do
    cp "${LIB}/src/controller/java/${jar}.jar" "${STAGE_DIR}.tmp/jars/${jar}.jar" 2>/dev/null || \
    cp "${LIB}/src/platform/android/${jar}.jar" "${STAGE_DIR}.tmp/jars/${jar}.jar"
done
cp "${LIB}/jni/arm64-v8a/libCHIPController.so" "${STAGE_DIR}.tmp/jni/arm64-v8a/"
cp "${LIB}/jni/arm64-v8a/libc++_shared.so" "${STAGE_DIR}.tmp/jni/arm64-v8a/"
(
    cd "${STAGE_DIR}.tmp"
    find jars jni -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)
rm -rf "${STAGE_DIR}"
mv "${STAGE_DIR}.tmp" "${STAGE_DIR}"
printf 'Staged pinned Matter Android controller at %s\n' "${STAGE_DIR}"
