package com.atmosscope.weather;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;

public final class MainActivity extends Activity {
    private static final String ORDINARY_HOME = "https://atmosscope-weather.phillipchan520.chatgpt.site/";
    private static final String PROFESSIONAL_HOME = "file:///android_asset/index.html";
    private WebView weatherView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(7,16,24));
        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setPadding(10,8,10,8);
        Button ordinary = new Button(this); ordinary.setText("普通天气");
        Button professional = new Button(this); professional.setText("专业图集");
        nav.addView(ordinary,new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1f));
        nav.addView(professional,new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1f));
        weatherView = new WebView(this);
        WebSettings s = weatherView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(true); s.setAllowContentAccess(true); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        weatherView.setWebViewClient(new WebViewClient());
        root.addView(nav,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(weatherView,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f));
        setContentView(root);
        ordinary.setOnClickListener(v -> loadOrdinary());
        professional.setOnClickListener(v -> loadProfessional());
        loadOrdinary();
    }

    private void loadOrdinary() {
        weatherView.getSettings().setAllowFileAccessFromFileURLs(false);
        weatherView.getSettings().setAllowUniversalAccessFromFileURLs(false);
        weatherView.loadUrl(ORDINARY_HOME);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void loadProfessional() {
        weatherView.getSettings().setAllowFileAccessFromFileURLs(true);
        weatherView.getSettings().setAllowUniversalAccessFromFileURLs(true);
        weatherView.loadUrl(PROFESSIONAL_HOME);
    }

    @Override public void onBackPressed() { if (weatherView != null && weatherView.canGoBack()) weatherView.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (weatherView != null) weatherView.destroy(); super.onDestroy(); }
}
