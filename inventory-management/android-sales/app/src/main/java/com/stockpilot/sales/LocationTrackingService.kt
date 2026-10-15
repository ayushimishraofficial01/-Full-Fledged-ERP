package com.stockpilot.sales

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.content.Context
import org.json.JSONObject
import java.util.concurrent.Executors

class LocationTrackingService : Service(), LocationListener {
    private lateinit var locationManager: LocationManager
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var isActive = false

    override fun onCreate() {
        super.onCreate()
        ApiClient.initialize(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopTracking()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        if (isActive) return START_STICKY
        startAsForeground()
        executor.execute {
            try {
                val current = ApiClient.request("GET", "/api/sales-visits/current")
                if (current.isNull("shift") || !current.getJSONObject("shift").optBoolean("isActive")) {
                    stopSelf()
                    return@execute
                }
                beginLocationUpdates()
            } catch (error: Exception) {
                updateNotification("Unable to confirm duty status. Open the app to reconnect.")
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun startAsForeground() {
        val notification = buildNotification("Duty location service is starting.")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun beginLocationUpdates() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            updateNotification("Location permission is missing. Reopen the app to restore tracking.")
            stopSelf()
            return
        }
        val provider = when {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> {
                updateNotification("Turn on device location to continue duty tracking.")
                stopSelf()
                return
            }
        }
        try {
            locationManager.requestLocationUpdates(provider, LOCATION_INTERVAL_MS, 0f, this, Looper.getMainLooper())
            isActive = true
            updateNotification("Duty tracking is active. Location updates about every 30 seconds.")
        } catch (error: SecurityException) {
            updateNotification("Background location permission is missing. Open the app to restore tracking.")
            stopSelf()
        }
    }

    override fun onLocationChanged(location: Location) {
        if (!isActive) return
        val point = JSONObject()
            .put("latitude", location.latitude)
            .put("longitude", location.longitude)
            .put("accuracy", location.accuracy.toDouble().coerceAtLeast(0.0))
        executor.execute {
            try {
                val result = ApiClient.request("POST", "/api/sales-visits/shifts/location", JSONObject().put("location", point))
                if (result.optBoolean("shiftEnded")) {
                    updateNotification("Office hours ended. Duty tracking has stopped.")
                    stopSelf()
                } else {
                    updateNotification("Duty tracking is active. Last location sent ${java.text.DateFormat.getTimeInstance().format(System.currentTimeMillis())}.")
                }
            } catch (error: Exception) {
                if (error.message?.contains("outside office hours", ignoreCase = true) == true) {
                    updateNotification("Office hours ended. Finish the active visit in the app.")
                    stopSelf()
                } else {
                    updateNotification("Location update could not sync. Check mobile data or Wi-Fi.")
                }
            }
        }
    }

    @Deprecated("Required by the platform listener API.")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) {
        updateNotification("Device location is off. Turn it on to continue tracking.")
    }

    private fun stopTracking() {
        isActive = false
        runCatching { locationManager.removeUpdates(this) }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Sales duty location",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Visible while an employee's consented duty location is being recorded."
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(message: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("GEN VYRO · Duty tracking")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification(message: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(message))
    }

    override fun onDestroy() {
        stopTracking()
        executor.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "com.stockpilot.sales.START_LOCATION_TRACKING"
        const val ACTION_STOP = "com.stockpilot.sales.STOP_LOCATION_TRACKING"
        private const val CHANNEL_ID = "sales-duty-location"
        private const val NOTIFICATION_ID = 4108
        private const val LOCATION_INTERVAL_MS = 30_000L
    }
}
