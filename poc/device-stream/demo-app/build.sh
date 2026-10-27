#!/bin/bash
# Builds the demo APK with the SDK's tools alone (no Gradle):
# javac → d8 → aapt2 link → zipalign → apksigner with a throwaway key.
set -euo pipefail
cd "$(dirname "$0")"
BT="$ANDROID_HOME/build-tools/34.0.0"
JAR="$ANDROID_HOME/platforms/android-30/android.jar"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/dex"
javac -g --release 8 -classpath "$JAR" -d "$OUT/classes" $(find src -name '*.java') 2>&1 | grep -v "options were deprecated\|-Xlint:-options\|bootstrap classpath" || true
"$BT/d8" --min-api 24 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
"$BT/aapt2" link -o "$OUT/unsigned.apk" --manifest AndroidManifest.xml -I "$JAR"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
[ -f "$OUT/../debug.keystore" ] || keytool -genkeypair -keystore "$OUT/../debug.keystore" -storepass android -keypass android \
  -alias demo -keyalg RSA -validity 3650 -dname "CN=demo" >/dev/null 2>&1
"$BT/apksigner" sign --ks debug.keystore --ks-pass pass:android --out "$OUT/session-demo.apk" "$OUT/aligned.apk"
echo "$OUT/session-demo.apk"
