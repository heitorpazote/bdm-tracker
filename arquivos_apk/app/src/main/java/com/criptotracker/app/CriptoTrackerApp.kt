package com.criptotracker.app

import android.app.Application
import android.webkit.WebView

class CriptoTrackerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Habilita debugging remoto da WebView em builds depuraveis (chrome://inspect).
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }
}
