package com.lexicards.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.speech.tts.TextToSpeech;
import java.util.Locale;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final int REQ_CREATE_FILE = 1001;
    private static final int REQ_CHOOSE_FILE = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingExportText;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    public class NativeBridge {

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        @JavascriptInterface
        public int sdk() {
            return Build.VERSION.SDK_INT;
        }

        @JavascriptInterface
        public String appVersion() {
            /* read the real versionName from the manifest, so the App info sheet
               and the update check never disagree with the installed build */
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.8";
            }
        }

        @JavascriptInterface
        public void vibrate(long ms) {
            final long dur = Math.max(1L, Math.min(ms, 1000L));
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                        if (v != null && v.hasVibrator()) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                v.vibrate(VibrationEffect.createOneShot(dur, VibrationEffect.DEFAULT_AMPLITUDE));
                            } else {
                                v.vibrate(dur);
                            }
                        }
                    } catch (Throwable ignored) {
                    }
                }
            });
        }

        /* the App info sheet hands the APK download (or the releases page) to
           the system browser - the browser does the download and Android
           installs the file, so no new permission is needed here */
        @JavascriptInterface
        public void openExternal(final String url) {
            if (url == null || url.trim().isEmpty()) return;
            final String target = url.trim();
            if (!target.startsWith("http://") && !target.startsWith("https://")) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(target));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "No app can open that link", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String filename, String content) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingExportText = content;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, filename != null ? filename : "lexicards-backup.json");
                    try {
                        startActivityForResult(intent, REQ_CREATE_FILE);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Cannot open file picker", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        /* A skin can repaint the system bars to match its own colours.  The web
           side passes the status-bar colour, the navigation-bar colour and
           whether the navigation bar wants dark glyphs (a white bar does).
           Both bars are painted on every skin change, classic included, or the
           colour of the last skin would stay behind. */
        @JavascriptInterface
        public void setSystemBars(final String statusHex, final String navHex, final boolean navLight) {
            final String status = hexColor(statusHex);
            final String nav = hexColor(navHex);
            if (status == null && nav == null) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Window window = getWindow();
                        if (status != null) window.setStatusBarColor(Color.parseColor(status));
                        if (nav != null) window.setNavigationBarColor(Color.parseColor(nav));
                        /* the status bar always carries white glyphs in both
                           skins, so only the navigation-bar flag can change */
                        setBarIconAppearance(window, false, navLight);
                    } catch (Throwable ignored) {
                    }
                }
            });
        }

        /* kept for older hosts that only know the status bar */
        @JavascriptInterface
        public void setThemeColor(final String hex) {
            setSystemBars(hex, null, true);
        }

        /* The home-screen icon comes from the manifest, so a skin cannot
           repaint it in place: every skin owns an activity-alias and exactly
           one of them is enabled.  The web side calls this on every applySkin,
           classic included, so the alias and the chosen skin never drift. */
        @JavascriptInterface
        public void setLauncherIcon(final String skin) {
            final boolean gothic = "gothic".equals(skin);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    /* enable the wanted one first, so the app never sits with
                       no launcher entry at all */
                    if (gothic) {
                        setAliasEnabled("LauncherGothic", true);
                        setAliasEnabled("LauncherClassic", false);
                    } else {
                        setAliasEnabled("LauncherClassic", true);
                        setAliasEnabled("LauncherGothic", false);
                    }
                }
            });
        }

        @JavascriptInterface
        public void speak(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (text == null || text.trim().isEmpty()) return;
                    final String toSpeak = text.trim();
                    if (tts != null && ttsReady) {
                        tts.speak(toSpeak, TextToSpeech.QUEUE_FLUSH, null, "lexi_speak");
                    } else {
                        // If TTS was not ready, initialize and play
                        initTTS(new Runnable() {
                            @Override
                            public void run() {
                                if (tts != null && ttsReady) {
                                    tts.speak(toSpeak, TextToSpeech.QUEUE_FLUSH, null, "lexi_speak");
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    /* a #RRGGBB string, or null when the argument is not one */
    private static String hexColor(String value) {
        if (value == null) return null;
        String v = value.trim();
        return v.matches("#[0-9a-fA-F]{6}") ? v : null;
    }

    /* enable / disable one launcher alias (DONT_KILL_APP: the app keeps
       running, only the home-screen entry changes) */
    private void setAliasEnabled(String alias, boolean enable) {
        try {
            ComponentName cn = new ComponentName(this, getPackageName() + "." + alias);
            getPackageManager().setComponentEnabledSetting(cn,
                enable ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                       : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
        } catch (Throwable ignored) {
            /* a host without the alias simply keeps the icon it has */
        }
    }

    private boolean isAliasEnabled(String alias) {
        try {
            ComponentName cn = new ComponentName(this, getPackageName() + "." + alias);
            return getPackageManager().getComponentEnabledSetting(cn)
                == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /* dark or light glyphs in the system bars.  WindowInsetsController is the
       modern way; the flags below it are what API 24..29 understands. */
    private void setBarIconAppearance(Window window, boolean statusLight, boolean navLight) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = window.getInsetsController();
            if (c != null) {
                c.setSystemBarsAppearance(
                    statusLight ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                c.setSystemBarsAppearance(
                    navLight ? WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0,
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
            return;
        }
        View decor = window.getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = statusLight ? (flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
                                : (flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags = navLight ? (flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
                             : (flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        decor.setSystemUiVisibility(flags);
    }

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        /* The launcher alias that started the app is the skin that was chosen
           last time, so the window behind the WebView is painted the right
           colour before a single line of JavaScript has run. */
        setTheme(isAliasEnabled("LauncherGothic") ? R.style.GothicTheme : R.style.AppTheme);
        super.onCreate(savedInstanceState);

        initTTS(null);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setAllowFileAccessFromFileURLs(false);
        ws.setAllowUniversalAccessFromFileURLs(false);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMediaPlaybackRequiresUserGesture(false);

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.addJavascriptInterface(new NativeBridge(), "LexiNative");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                              FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                Intent intent = params != null ? params.createIntent() : new Intent(Intent.ACTION_GET_CONTENT);
                if (intent.getType() == null) {
                    intent.setType("application/json");
                }
                try {
                    startActivityForResult(intent, REQ_CHOOSE_FILE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if ("https".equals(uri.getScheme()) && "app.lexicards".equals(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path) || "/index.html".equals(path)) {
                        try {
                            InputStream is = getAssets().open("index.html");
                            WebResourceResponse resp = new WebResourceResponse("text/html", "UTF-8", is);
                            resp.setResponseHeaders(java.util.Collections.singletonMap("Access-Control-Allow-Origin", "*"));
                            return resp;
                        } catch (Exception ignored) {
                        }
                    }
                }
                return super.shouldInterceptRequest(view, req);
            }
        });

        webView.loadUrl("https://app.lexicards/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.lexiHandleBack ? window.lexiHandleBack() : false", new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String val) {
                    if (!"true".equals(val)) {
                        MainActivity.super.onBackPressed();
                    }
                }
            });
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_CREATE_FILE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExportText != null) {
                Uri uri = data.getData();
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os != null) {
                        os.write(pendingExportText.getBytes(StandardCharsets.UTF_8));
                        os.flush();
                        Toast.makeText(this, "Exported successfully", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "Save failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingExportText = null;
            return;
        }

        if (requestCode == REQ_CHOOSE_FILE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }


    private void initTTS(final Runnable onReady) {
        if (tts != null && ttsReady) {
            if (onReady != null) onReady.run();
            return;
        }
        try {
            tts = new TextToSpeech(getApplicationContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && tts != null) {
                        int res = tts.setLanguage(Locale.US);
                        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                            tts.setLanguage(Locale.ENGLISH);
                        }
                        ttsReady = true;
                        if (onReady != null) {
                            runOnUiThread(onReady);
                        }
                    }
                }
            });
        } catch (Exception e) {
            ttsReady = false;
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
        super.onDestroy();
    }
}
