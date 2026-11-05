package com.moviebox.plus;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * The stock Capacitor BridgeActivity lets the OS kill the app whenever the
 * WebView renderer dies — which happens on memory-constrained devices when the
 * feed's images push the renderer past its per-process limit. On those devices
 * the app simply vanishes instead of recovering.
 *
 * Handling onRenderProcessGone keeps the process alive: the dead WebView is
 * torn down and the activity restarts with a fresh renderer.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                ViewGroup parent = (ViewGroup) webView.getParent();
                if (parent != null) {
                    parent.removeView(webView);
                }
                webView.destroy();
                recreate();
                return true;
            }
        });
    }
}
