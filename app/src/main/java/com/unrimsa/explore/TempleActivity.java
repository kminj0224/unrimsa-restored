package com.unrimsa.explore;

import android.app.Activity;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class TempleActivity extends Activity {
    private static final String HOST = "unrimsa.local";

    private WebView viewer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        viewer = new WebView(this);
        viewer.setBackgroundColor(0xff253a31);
        viewer.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = viewer.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        viewer.setWebViewClient(new LocalAssets());
        setContentView(viewer);
        immersive();
        viewer.loadUrl("https://" + HOST + "/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (viewer != null) {
            viewer.onResume();
        }
        immersive();
    }

    @Override
    protected void onPause() {
        if (viewer != null) {
            viewer.evaluateJavascript("window.pauseTemple&&window.pauseTemple()", null);
            viewer.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (viewer != null) {
            if (viewer.getParent() instanceof ViewGroup) {
                ((ViewGroup) viewer.getParent()).removeView(viewer);
            }
            viewer.destroy();
            viewer = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            immersive();
        }
    }

    private void immersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    private final class LocalAssets extends WebViewClient {
        private LocalAssets() {}

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String path = url.getPath();
            if (!"https".equals(url.getScheme()) || !HOST.equals(url.getHost())
                    || path == null || !path.matches("/[a-zA-Z0-9_./-]+")
                    || path.contains("..") || path.contains("//")) {
                return missing();
            }

            String mimeType = mimeTypeFor(path);
            if (mimeType == null) {
                return missing();
            }

            try {
                String encoding = mimeType.startsWith("text") || mimeType.contains("javascript")
                        ? "UTF-8" : null;
                return new WebResourceResponse(
                        mimeType, encoding, 200, "OK",
                        Collections.singletonMap("X-Content-Type-Options", "nosniff"),
                        getAssets().open(path.substring(1)));
            } catch (IOException exception) {
                return missing();
            }
        }

        private WebResourceResponse missing() {
            return new WebResourceResponse(
                    "text/plain", "UTF-8", 404, "Not Found",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mimeTypeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg")) return "image/jpeg";
        if (path.endsWith(".ogg")) return "audio/ogg";
        if (path.endsWith(".glb")) return "model/gltf-binary";
        return null;
    }
}
