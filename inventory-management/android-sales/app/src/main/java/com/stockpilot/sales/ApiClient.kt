package com.stockpilot.sales

import android.content.Context
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpCookie
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

class ApiException(message: String, val statusCode: Int = 0) : Exception(message)

object ApiClient {
    private const val PREFS = "stockpilot_sales"
    private const val COOKIE_KEY = "session_cookies"
    private lateinit var appContext: Context
    private val cookieManager = CookieManager(null, CookiePolicy.ACCEPT_ALL)
    @Volatile private var initialized = false

    fun initialize(context: Context) {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            appContext = context.applicationContext
            CookieHandlerInstaller.install(cookieManager)
            initialized = true
        }
    }

    fun apiOrigin(): String = preferences().getString("api_origin", "").orEmpty()

    fun webOrigin(): String = preferences().getString("web_origin", "").orEmpty()

    fun saveWebOrigin(value: String) {
        val origin = value.trim().trimEnd('/')
        val uri = runCatching { URI(origin) }.getOrNull()
            ?: throw ApiException("Enter your StockPilot web app address, such as https://app.example.com.")
        val localHttp = BuildConfig.DEBUG && uri.scheme == "http" && (
            uri.host == "10.0.2.2" || uri.host == "localhost" ||
                uri.host == "127.0.0.1" || uri.host?.startsWith("192.168.") == true
            )
        if (uri.host.isNullOrBlank() || (uri.scheme != "https" && !localHttp) ||
            uri.userInfo != null || uri.rawQuery != null || uri.rawFragment != null ||
            uri.path.orEmpty().isNotBlank() && uri.path != "/"
        ) {
            throw ApiException("Use your StockPilot HTTPS web app origin only (no path). HTTP is allowed for local development.")
        }
        preferences().edit().putString("web_origin", origin).apply()
    }

    fun saveApiOrigin(value: String) {
        val origin = value.trim().trimEnd('/')
        val uri = runCatching { URI(origin) }.getOrNull()
            ?: throw ApiException("Enter a valid API origin, such as https://api.example.com.")
        val localHttp = uri.scheme == "http" && (
            uri.host == "10.0.2.2" || uri.host == "localhost" ||
                uri.host == "127.0.0.1" || uri.host?.startsWith("192.168.") == true
            )
        if (uri.host.isNullOrBlank() || (uri.scheme != "https" && !localHttp) || uri.rawQuery != null || uri.rawFragment != null) {
            throw ApiException("Use a public HTTPS API origin without /api. HTTP is allowed only for local development.")
        }
        preferences().edit().putString("api_origin", origin).apply()
    }

    fun clearSession() {
        cookieManager.cookieStore.removeAll()
        preferences().edit().remove(COOKIE_KEY).remove("user_name").remove("user_email").apply()
    }

    fun saveUser(name: String, email: String) {
        preferences().edit().putString("user_name", name).putString("user_email", email).apply()
    }

    fun savedUserName(): String = preferences().getString("user_name", "").orEmpty()

    fun request(method: String, path: String, body: JSONObject? = null): JSONObject {
        val response = requestBytes(method, path, body?.toString()?.toByteArray(), "application/json")
        return if (response.isEmpty()) JSONObject() else JSONObject(response.toString(Charsets.UTF_8))
    }

    fun uploadVisitPhoto(visitId: String, location: JSONObject, file: File): JSONObject {
        if (!file.isFile || file.length() <= 0 || file.length() > 2 * 1024 * 1024) {
            throw ApiException("Choose a valid visit photo smaller than 2 MB.")
        }
        val boundary = "StockPilot-${System.currentTimeMillis()}"
        val bytes = ByteArrayOutputStream().apply {
            write("--$boundary\r\n".toByteArray())
            write("Content-Disposition: form-data; name=\"location\"\r\n".toByteArray())
            write("Content-Type: application/json; charset=utf-8\r\n\r\n".toByteArray())
            write(location.toString().toByteArray())
            write("\r\n--$boundary\r\n".toByteArray())
            write("Content-Disposition: form-data; name=\"image\"; filename=\"visit-proof.jpg\"\r\n".toByteArray())
            write("Content-Type: image/jpeg\r\n\r\n".toByteArray())
            file.inputStream().use { it.copyTo(this) }
            write("\r\n--$boundary--\r\n".toByteArray())
        }.toByteArray()
        val response = requestBytes(
            "POST",
            "/api/sales-visits/visits/$visitId/check-out",
            bytes,
            "multipart/form-data; boundary=$boundary",
        )
        return JSONObject(response.toString(Charsets.UTF_8))
    }

    fun downloadVisitPhoto(visitId: String): ByteArray =
        requestBytes("GET", "/api/sales-visits/visits/$visitId/photo")

    private fun requestBytes(
        method: String,
        path: String,
        body: ByteArray? = null,
        contentType: String? = null,
    ): ByteArray {
        if (!initialized) throw ApiException("The app API client is not initialized.")
        val origin = apiOrigin()
        if (origin.isBlank()) throw ApiException("Set the public HTTPS API address first.")
        restoreCookies(origin)
        val connection = (URL("$origin$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 30_000
            useCaches = false
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", contentType ?: "application/json")
                outputStream.use { it.write(body) }
            }
        }
        return try {
            val status = connection.responseCode
            persistCookies(origin)
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use { it.readBytes() } ?: ByteArray(0)
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response.toString(Charsets.UTF_8)).optString("message") }
                    .getOrNull().orEmpty()
                throw ApiException(message.ifBlank { "The server returned HTTP $status." }, status)
            }
            response
        } finally {
            connection.disconnect()
        }
    }

    private fun restoreCookies(origin: String) {
        val uri = URI(origin)
        if (cookieManager.cookieStore.get(uri).isNotEmpty()) return
        val saved = preferences().getString(COOKIE_KEY, "").orEmpty()
        saved.split('\n').filter(String::isNotBlank).forEach { value ->
            runCatching { HttpCookie.parse(value).forEach { cookieManager.cookieStore.add(uri, it) } }
        }
    }

    private fun persistCookies(origin: String) {
        val serialized = cookieManager.cookieStore.get(URI(origin))
            .filterNot { it.hasExpired() }
            .joinToString("\n") { it.toString() }
        preferences().edit().putString(COOKIE_KEY, serialized).apply()
    }

    private fun preferences() = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

private object CookieHandlerInstaller {
    fun install(manager: CookieManager) {
        java.net.CookieHandler.setDefault(manager)
    }
}
