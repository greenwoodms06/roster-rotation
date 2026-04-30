package com.greenwoodms06.rotations;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Wire window.AndroidPrint.print(html) to Android's PrintManager. The
        // default WebView silently no-ops on window.print(); we render the
        // print HTML in an off-screen WebView and hand its document adapter to
        // the system print dialog.
        bridge.getWebView().addJavascriptInterface(new PrintBridge(this), "AndroidPrint");
    }
}

class PrintBridge {
    private final MainActivity activity;

    PrintBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void print(final String html) {
        activity.runOnUiThread(() -> {
            final WebView pwv = new WebView(activity);
            pwv.getSettings().setJavaScriptEnabled(false);
            pwv.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    PrintManager pm = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                    String jobName = "Rotations Lineup";
                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                    pm.print(jobName, adapter, new PrintAttributes.Builder().build());
                }
            });
            pwv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
