# StockPilot Android app

Android app combining the existing native field-sales tools with the StockPilot inventory portal. The inventory portal opens inside a secure WebView; its screens and backend must be deployed and reachable from the device. Open this `android-sales` folder in Android Studio, let it install the Android SDK/Gradle dependencies, and run the `app` configuration on an Android 8.0+ device.

## First connection

On first launch:

1. Enter the deployed StockPilot **web app origin** (for example `https://app.example.com`) and tap **Open inventory management**. The app opens the existing React screens inside Android; sign in there with your normal StockPilot account. The web app must be served over HTTPS and its API requests must resolve correctly from that origin.
2. For native background sales tracking, enter the public **API origin** (for example `https://api.example.com`, without `/api`) and sign in with a staff account created in **Settings → User & Access**. The API address is stored on the device and can be changed later.

These are deployment URLs, not API keys. Release builds permit HTTPS only; debug builds also allow HTTP for local development.

## Location and visit flow

1. The user signs in and confirms the location notice.
2. Android requests precise location, **Allow all the time** background location, and notification permission. These are required for the locked-screen tracking service.
3. The user starts working hours during the configured office hours. A persistent foreground-service notification stays visible while location samples are sent about every 30 seconds.
4. The user enters a visit location, sets the pin at the location, checks in, then takes a camera photo and checks out inside the 150 m geofence.
5. Visit history is available to the user in the native Sales section. Managers can review all configured users, shift trails, visit times, durations, and private photo proof in **Sales Visits → Team Overview**.

The embedded inventory portal supports web camera and location permission prompts while open. Background location tracking is handled by the separate native Sales service, not by the WebView.

Location begins only after an explicit staff action and OS permission. It continues while the foreground location service is running if the screen is locked or the app task is dismissed. Android Force Stop, revoked permissions, device shutdown, battery controls, GPS/network loss, and manufacturer-specific process restrictions can interrupt tracking. This is not tamper-proof GPS. Staff should see the persistent notification and the company's location-use notice.

## Backend

The existing Express backend must be reachable from the phone over HTTPS and have the Sales Visits API deployed. API session cookies are stored on-device; no password is saved by the app. Do not use a production HTTP URL.

## Building

Requires Android Studio, JDK 17, and Android SDK Platform 35. The Gradle wrapper is included; open this folder in Android Studio and let it install the required SDK and Gradle dependencies before building or signing the APK or Play Store bundle.
