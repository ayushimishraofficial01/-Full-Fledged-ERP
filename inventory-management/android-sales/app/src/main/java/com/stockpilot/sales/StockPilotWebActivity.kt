package com.stockpilot.sales

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat

class StockPilotWebActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var loadError: TextView
    private lateinit var trustedOrigin: Uri
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingGeolocation: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ApiClient.initialize(this)
        val origin = ApiClient.webOrigin()
        if (origin.isBlank()) {
            Toast.makeText(this, "Set your StockPilot web app address first.", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        trustedOrigin = Uri.parse(origin)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFFF8FAFC.toInt())
        }
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(6), dp(12), dp(6))
        }
        root.addView(toolbar)
        val backButton = Button(this).apply {
            text = "Back"
            isAllCaps = false
            setOnClickListener { finish() }
        }
        toolbar.addView(backButton)
        val title = TextView(this).apply {
            text = "GEN VYRO"
            textSize = 18f
            setTextColor(0xFF0F172A.toInt())
            setPadding(dp(12), 0, 0, 0)
        }
        toolbar.addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        val refreshButton = Button(this).apply {
            text = "Refresh"
            isAllCaps = false
        }
        toolbar.addView(refreshButton)

        loadError = TextView(this).apply {
            text = "Unable to load StockPilot. Check your connection and refresh."
            textSize = 14f
            setTextColor(0xFFB91C1C.toInt())
            setPadding(dp(16), dp(10), dp(16), dp(10))
            visibility = View.GONE
        }
        root.addView(loadError)

        webView = WebView(this)
        root.addView(webView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f,
        ))
        setContentView(root)

        CookieManager.getInstance().setAcceptCookie(true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(true)
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val target = request.url
                if (isTrustedOrigin(target)) {
                    return false
                }
                if (target.scheme == "https" || target.scheme == "mailto" || target.scheme == "tel") {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, target)) }
                        .onFailure { Toast.makeText(this@StockPilotWebActivity, "No app can open this link.", Toast.LENGTH_SHORT).show() }
                }
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                loadError.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError,
            ) {
                if (request.isForMainFrame) loadError.visibility = View.VISIBLE
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val allowed = request.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
                if (allowed.isEmpty() || !isTrustedOrigin(request.origin)) {
                    request.deny()
                    return
                }
                if (ContextCompat.checkSelfPermission(this@StockPilotWebActivity, android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(allowed.toTypedArray())
                } else {
                    pendingWebPermission = request
                    requestPermissions(arrayOf(android.Manifest.permission.CAMERA), REQUEST_CAMERA)
                }
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (!isTrustedOrigin(Uri.parse(origin))) {
                    callback.invoke(origin, false, false)
                    return
                }
                val hasLocation = ContextCompat.checkSelfPermission(this@StockPilotWebActivity, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(this@StockPilotWebActivity, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                if (hasLocation) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeolocation = callback
                    pendingGeolocationOrigin = origin
                    requestPermissions(
                        arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION),
                        REQUEST_LOCATION,
                    )
                }
            }
        }
        refreshButton.setOnClickListener { webView.reload() }
        webView.loadUrl(origin)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            REQUEST_CAMERA -> {
                val request = pendingWebPermission
                pendingWebPermission = null
                if (request != null) {
                    if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    } else {
                        request.deny()
                    }
                }
            }
            REQUEST_LOCATION -> {
                val origin = pendingGeolocationOrigin
                val callback = pendingGeolocation
                pendingGeolocationOrigin = null
                pendingGeolocation = null
                if (origin != null && callback != null) {
                    callback.invoke(origin, grantResults.any { it == PackageManager.PERMISSION_GRANTED }, false)
                }
            }
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun isTrustedOrigin(uri: Uri): Boolean =
        uri.scheme == trustedOrigin.scheme &&
            uri.host.equals(trustedOrigin.host, ignoreCase = true) &&
            uri.port == trustedOrigin.port

    companion object {
        private const val REQUEST_CAMERA = 6101
        private const val REQUEST_LOCATION = 6102
    }
}
