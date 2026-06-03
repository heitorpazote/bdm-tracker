package com.criptotracker.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.criptotracker.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val webView: WebView get() = binding.webView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge: a app web ja cuida do safe area com env(safe-area-inset-*).
        WindowCompat.setDecorFitsSystemWindows(window, false)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configureWebView()
        installBackHandler()

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(INDEX_URL)
        }
    }

    private fun configureWebView() = with(webView) {
        setBackgroundColor(0xFF09090B.toInt())

        // Habilita modo escuro do sistema na WebView (>= API 29).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)
        }

        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true

            // Cache HTTP padrao.
            cacheMode = WebSettings.LOAD_DEFAULT

            // Acesso a assets locais (file:///android_asset/...).
            allowFileAccess = true
            allowContentAccess = true

            // Misto: deixamos OFF — o app web usa HTTPS (Supabase).
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

            // Viewport e responsividade.
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // Comportamento de mídia / janelas.
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)

            // User agent: marca como app embarcado para telemetria/CDN reconhecer.
            userAgentString = "$userAgentString CriptoTrackerAndroid/${BuildConfig.VERSION_NAME}"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(this@with, true)
        }

        webViewClient = AppWebViewClient()
        webChromeClient = AppWebChromeClient()

        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
    }

    private fun installBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        // Libera recursos da WebView.
        binding.root.removeView(webView)
        webView.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }

    // =====================================================================
    // Clients
    // =====================================================================

    private inner class AppWebViewClient : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            return when {
                isInternalUrl(url) -> false
                url.scheme == "tel" || url.scheme == "mailto" || url.scheme == "sms" -> {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                }
                else -> {
                    // Abre links externos no navegador.
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                }
            }
        }

        private fun isInternalUrl(url: Uri): Boolean {
            if (url.scheme == "file" && url.toString().startsWith(ASSETS_BASE)) return true
            // Domínios que devem rodar dentro do WebView (Supabase, CDNs usados pelo app).
            val host = url.host ?: return false
            return host.endsWith("supabase.co") ||
                host.endsWith("supabase.in") ||
                host.endsWith("openrouter.ai") ||
                host == "cdn.tailwindcss.com" ||
                host.endsWith("googleapis.com") ||
                host.endsWith("gstatic.com")
        }
    }

    private inner class AppWebChromeClient : WebChromeClient() {
        override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
            if (BuildConfig.DEBUG) {
                android.util.Log.d(
                    "WebViewConsole",
                    "[${msg.messageLevel()}] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})"
                )
            }
            return true
        }
    }

    companion object {
        private const val ASSETS_BASE = "file:///android_asset/web/"
        private const val INDEX_URL = "${ASSETS_BASE}index.html"
    }
}
