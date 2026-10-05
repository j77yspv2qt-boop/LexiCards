#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE)
HTML_SOURCE = os.path.join(PROJECT_ROOT, "index.html")
ASSETS_HTML = os.path.join(BASE, "assets", "index.html")

SDK = "/opt/homebrew/share/android-commandlinetools"
BT = os.path.join(SDK, "build-tools", "35.0.0")
PLATFORM_JAR = os.path.join(SDK, "platforms", "android-35", "android.jar")

JAVA_HOME = "/opt/homebrew/opt/openjdk@17"
JAVAC = os.path.join(JAVA_HOME, "bin", "javac")
KEYTOOL = os.path.join(JAVA_HOME, "bin", "keytool")

AAPT2 = os.path.join(BT, "aapt2")
D8 = os.path.join(BT, "d8")
ZIPALIGN = os.path.join(BT, "zipalign")
APKSIGNER = os.path.join(BT, "apksigner")

BUILD_DIR = os.path.join(BASE, "build")
GEN_DIR = os.path.join(BUILD_DIR, "gen")
OBJ_DIR = os.path.join(BUILD_DIR, "obj")
DEX_DIR = os.path.join(BUILD_DIR, "dex")
RES_FLAT = os.path.join(BUILD_DIR, "res_compiled")
RES_ZIP = os.path.join(BUILD_DIR, "compiled.zip")
UNALIGNED_APK = os.path.join(BUILD_DIR, "app-unaligned.apk")
ALIGNED_APK = os.path.join(BUILD_DIR, "app-aligned.apk")
FINAL_APK = os.path.join(PROJECT_ROOT, "LexiCards.apk")
KEYSTORE = os.path.join(BASE, "debug.keystore")

def run(cmd, desc):
    print("==>", desc)
    env = os.environ.copy()
    env["JAVA_HOME"] = JAVA_HOME
    env["PATH"] = os.path.join(JAVA_HOME, "bin") + ":" + env.get("PATH", "")
    res = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if res.returncode != 0:
        print("FAILED:", desc)
        print("STDERR:", res.stderr)
        print("STDOUT:", res.stdout)
        sys.exit(1)
    return res

def main():
    print("--- Building LexiCards APK ---")
    os.makedirs(BUILD_DIR, exist_ok=True)
    os.makedirs(GEN_DIR, exist_ok=True)
    os.makedirs(OBJ_DIR, exist_ok=True)
    os.makedirs(DEX_DIR, exist_ok=True)
    os.makedirs(RES_FLAT, exist_ok=True)

    print("==> Updating HTML in assets/")
    shutil.copy2(HTML_SOURCE, ASSETS_HTML)

    if not os.path.exists(os.path.join(BASE, "res", "mipmap-mdpi", "ic_launcher.png")):
        run([sys.executable, os.path.join(BASE, "icons", "make_icons.py")], "Generate Icons")

    # 1. Compile Resources with AAPT2
    run([AAPT2, "compile", "--dir", os.path.join(BASE, "res"), "-o", RES_ZIP], "AAPT2 Compile Resources")

    # 2. Link Resources
    manifest = os.path.join(BASE, "AndroidManifest.xml")
    run([
        AAPT2, "link",
        "-I", PLATFORM_JAR,
        "--manifest", manifest,
        "--java", GEN_DIR,
        "-A", os.path.join(BASE, "assets"),
        "-o", UNALIGNED_APK,
        "--auto-add-overlay",
        RES_ZIP
    ], "AAPT2 Link APK")

    # 3. Compile Java sources
    java_files = [
        os.path.join(BASE, "src", "com", "lexicards", "app", "MainActivity.java"),
        os.path.join(BASE, "src", "com", "lexicards", "app", "ReminderReceiver.java"),
        os.path.join(GEN_DIR, "com", "lexicards", "app", "R.java")
    ]
    run([
        JAVAC,
        "-encoding", "UTF-8",
        "-source", "17",
        "-target", "17",
        "-classpath", PLATFORM_JAR,
        "-d", OBJ_DIR
    ] + java_files, "javac Compile")

    # 4. Convert classes to DEX with D8
    class_files = []
    for root, _, files in os.walk(OBJ_DIR):
        for f in files:
            if f.endswith(".class"):
                class_files.append(os.path.join(root, f))

    run([
        D8,
        "--min-api", "24",
        "--lib", PLATFORM_JAR,
        "--output", DEX_DIR
    ] + class_files, "D8 Dex")

    # 5. Add classes.dex into APK
    classes_dex = os.path.join(DEX_DIR, "classes.dex")
    shutil.copy(classes_dex, os.path.join(BUILD_DIR, "classes.dex"))
    env = os.environ.copy()
    env["JAVA_HOME"] = JAVA_HOME
    env["PATH"] = os.path.join(JAVA_HOME, "bin") + ":" + env.get("PATH", "")
    subprocess.run([os.path.join(JAVA_HOME, "bin", "jar"), "-uf", UNALIGNED_APK, "-C", BUILD_DIR, "classes.dex"], check=True, cwd=BUILD_DIR, env=env)

    # 6. Zipalign
    if os.path.exists(ALIGNED_APK):
        os.remove(ALIGNED_APK)
    run([ZIPALIGN, "-f", "-p", "4", UNALIGNED_APK, ALIGNED_APK], "zipalign")

    # 7. Generate debug keystore if not exists
    if not os.path.exists(KEYSTORE):
        run([
            KEYTOOL, "-genkeypair",
            "-keystore", KEYSTORE,
            "-storepass", "android",
            "-alias", "androiddebugkey",
            "-keypass", "android",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-dname", "CN=Android Debug,O=Android,C=US"
        ], "Generate debug keystore")

    # 8. Sign APK with apksigner
    if os.path.exists(FINAL_APK):
        os.remove(FINAL_APK)
    run([
        APKSIGNER, "sign",
        "--ks", KEYSTORE,
        "--ks-pass", "pass:android",
        "--ks-key-alias", "androiddebugkey",
        "--key-pass", "pass:android",
        "--out", FINAL_APK,
        ALIGNED_APK
    ], "apksigner Sign")

    # Verify APK signature
    v = run([APKSIGNER, "verify", "--verbose", FINAL_APK], "Verify APK")
    print("APK built and verified successfully:", FINAL_APK)
    print("File size:", os.path.getsize(FINAL_APK), "bytes")

if __name__ == "__main__":
    main()
