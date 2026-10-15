package com.stockpilot.sales

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Looper
import android.provider.MediaStore
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors

private data class VisitRequirementInput(
    val productId: String,
    val productName: String,
    val quantityInput: EditText,
    val unitInput: Spinner,
    val noteInput: EditText,
)

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var content: LinearLayout
    private lateinit var loginPanel: LinearLayout
    private lateinit var dutyPanel: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var webOriginInput: EditText
    private lateinit var apiOriginInput: EditText
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var visitNameInput: EditText
    private lateinit var latitudeInput: EditText
    private lateinit var longitudeInput: EditText
    private lateinit var requirementRows: LinearLayout
    private lateinit var consentCheckBox: CheckBox
    private lateinit var visitRows: LinearLayout
    private lateinit var visitPhotoButton: Button
    private var currentUser = JSONObject()
    private var currentShift = JSONObject()
    private var visits = emptyList<JSONObject>()
    private var activeVisit: JSONObject? = null
    private var pendingPermissionAction: (() -> Unit)? = null
    private var visitPhotoFile: File? = null
    private var requestingPhoto = false
    private val visitRequirements = mutableListOf<VisitRequirementInput>()
    private var availableRequirementUnits = emptyList<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ApiClient.initialize(this)
        buildScreen()
        webOriginInput.setText(ApiClient.webOrigin())
        if (ApiClient.apiOrigin().isNotBlank()) {
            apiOriginInput.setText(ApiClient.apiOrigin())
            loadSession()
        }
    }

    private fun buildScreen() {
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(32))
            setBackgroundColor(0xFFF8FAFC.toInt())
        }
        scroll.addView(content)
        setContentView(scroll)

        val brandBanner = ImageView(this).apply {
            setImageResource(R.drawable.gen_vyro_banner)
            contentDescription = "GEN VYRO logo"
            scaleType = ImageView.ScaleType.FIT_CENTER
            adjustViewBounds = true
        }
        content.addView(brandBanner, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(176),
        ))
        addText(content, "GEN VYRO", 26f, bold = true, color = 0xFF0F172A.toInt())
        addText(content, "Inventory · stock · field sales", 15f, color = 0xFF475569.toInt(), bottom = 16)

        statusText = addText(content, "Connect to your company server to continue.", 14f, color = 0xFF475569.toInt(), bottom = 12)
        val portalCard = panel(content)
        addText(portalCard, "Inventory management app", 18f, bold = true, bottom = 4)
        addText(portalCard, "Enter your deployed StockPilot web app address. Your existing web screens open inside this Android app.", 13f, color = 0xFF475569.toInt(), bottom = 8)
        webOriginInput = editText("StockPilot web app URL, e.g. https://app.example.com").apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        portalCard.addView(webOriginInput)
        val openPortalButton = button("Open inventory management")
        portalCard.addView(openPortalButton)
        openPortalButton.setOnClickListener { openStockPilotPortal() }

        loginPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.VISIBLE
        }
        content.addView(loginPanel)
        addText(loginPanel, "Server connection", 18f, bold = true, bottom = 8)
        apiOriginInput = editText("Public HTTPS API address, e.g. https://api.example.com").also { loginPanel.addView(it) }
        addText(loginPanel, "Enter the server address only (no /api). You can change it later.", 12f, color = 0xFF64748B.toInt(), bottom = 10)
        emailInput = editText("Work email").also { loginPanel.addView(it) }
        emailInput.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        emailInput.imeOptions = EditorInfo.IME_ACTION_NEXT
        passwordInput = editText("Password").also { loginPanel.addView(it) }
        passwordInput.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        val signInButton = button("Save server & sign in")
        loginPanel.addView(signInButton)
        signInButton.setOnClickListener { login() }

        dutyPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
        }
        content.addView(dutyPanel)
        buildDutyPanel()
    }

    private fun buildDutyPanel() {
        addText(dutyPanel, "Location tracking notice", 18f, bold = true, bottom = 6)
        addText(
            dutyPanel,
            "While duty is active, this Android app shares location about every 30 seconds, including while the screen is locked. A persistent notification remains visible. Tracking can stop if Android force-stops the app, permissions are removed, the phone is off, GPS/network is unavailable, or battery controls restrict it. GPS can be inaccurate or spoofed.",
            13f,
            color = 0xFF475569.toInt(),
            bottom = 8,
        )
        addText(dutyPanel, "You and authorised managers can see the saved location history.", 12f, color = 0xFF64748B.toInt(), bottom = 10)

        val shiftCard = panel(dutyPanel)
        addText(shiftCard, "Office schedule", 17f, bold = true, bottom = 4)
        addText(shiftCard, "The schedule is set by your manager.", 13f, color = 0xFF475569.toInt(), bottom = 10)
        addText(shiftCard, "Duty status", 17f, bold = true, bottom = 4)
        addText(shiftCard, "No active duty", 14f, color = 0xFF475569.toInt(), bottom = 8)
        consentCheckBox = CheckBox(this).apply {
            text = "I consent to location updates while I am on duty, including when the phone is locked."
            textSize = 14f
            setTextColor(0xFF334155.toInt())
        }
        shiftCard.addView(consentCheckBox)
        val dutyActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        shiftCard.addView(dutyActions)
        val startButton = button("Start / resume tracking")
        startButton.setOnClickListener {
            if (currentShift.optBoolean("isActive")) {
                ensureTrackingPermissions {
                    startTrackingServiceIfPermitted()
                    showMessage("Background location tracking is running while duty remains active.")
                }
            } else if (!consentCheckBox.isChecked) {
                showMessage("Please confirm the location notice before starting duty.")
            } else {
                ensureTrackingPermissions { startDuty() }
            }
        }
        dutyActions.addView(startButton, weightedParams())
        val endButton = button("End duty")
        endButton.setOnClickListener { endDuty() }
        dutyActions.addView(endButton, weightedParams())

        val visitCard = panel(dutyPanel)
        addText(visitCard, "Visit check-in", 18f, bold = true, bottom = 4)
        addText(visitCard, "Check-in and check-out must be within 150 m of the visit pin; GPS accuracy must be 100 m or better.", 13f, color = 0xFF475569.toInt(), bottom = 8)
        visitNameInput = editText("Customer or visit location").also { visitCard.addView(it) }
        val locationButton = button("Use my GPS as visit pin")
        visitCard.addView(locationButton)
        locationButton.setOnClickListener { readCurrentLocation { location -> setLocationInputs(location) } }
        latitudeInput = editText("Latitude").also { visitCard.addView(it) }
        latitudeInput.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        longitudeInput = editText("Longitude").also { visitCard.addView(it) }
        longitudeInput.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        addText(visitCard, "Customer product requirements", 16f, bold = true, bottom = 4)
        addText(visitCard, "Select products from the catalog and enter the requested quantity.", 13f, color = 0xFF475569.toInt(), bottom = 6)
        val addRequirementButton = button("Add product requirement")
        visitCard.addView(addRequirementButton)
        addRequirementButton.setOnClickListener { searchRequirementProduct() }
        requirementRows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        visitCard.addView(requirementRows)
        val checkInButton = button("Check in at visit")
        visitCard.addView(checkInButton)
        checkInButton.setOnClickListener { checkIn() }
        visitPhotoButton = button("Check in to a visit to take its photo")
        visitPhotoButton.isEnabled = false
        visitCard.addView(visitPhotoButton)
        visitPhotoButton.setOnClickListener { captureVisitPhoto() }

        val historyCard = panel(dutyPanel)
        val historyHeader = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        historyCard.addView(historyHeader)
        addText(historyHeader, "My visit history", 18f, bold = true, bottom = 4)
        val refreshButton = button("Refresh")
        historyHeader.addView(refreshButton)
        refreshButton.setOnClickListener { refreshSalesData() }
        visitRows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        historyCard.addView(visitRows)
        val logoutButton = button("Sign out")
        dutyPanel.addView(logoutButton)
        logoutButton.setOnClickListener { logout() }
    }

    private fun login() {
        val origin = apiOriginInput.text.toString()
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (email.isBlank() || password.isBlank()) {
            showMessage("Enter your work email and password.")
            return
        }
        setBusy("Connecting to the server…")
        executor.execute {
            try {
                ApiClient.saveApiOrigin(origin)
                val response = ApiClient.request(
                    "POST",
                    "/api/auth/login",
                    JSONObject().put("email", email).put("password", password),
                )
                val user = response.getJSONObject("user")
                requireSalesPermission(user)
                ApiClient.saveUser(user.optString("name"), user.optString("email"))
                runOnUiThread {
                    passwordInput.setText("")
                    showAuthenticatedUser(user)
                    refreshSalesData()
                }
            } catch (error: Exception) {
                showError(error)
            }
        }
    }

    private fun openStockPilotPortal() {
        try {
            ApiClient.saveWebOrigin(webOriginInput.text.toString())
            startActivity(Intent(this, StockPilotWebActivity::class.java))
        } catch (error: Exception) {
            showError(error)
        }
    }

    private fun loadSession() {
        setBusy("Checking your signed-in session…")
        executor.execute {
            try {
                val user = ApiClient.request("GET", "/api/auth/me").getJSONObject("user")
                requireSalesPermission(user)
                ApiClient.saveUser(user.optString("name"), user.optString("email"))
                runOnUiThread {
                    showAuthenticatedUser(user)
                    refreshSalesData()
                }
            } catch (error: ApiException) {
                if (error.statusCode == 401) {
                    runOnUiThread {
                        loginPanel.visibility = View.VISIBLE
                        dutyPanel.visibility = View.GONE
                        statusText.text = "Sign in with a sales user account."
                    }
                } else {
                    showError(error)
                }
            } catch (error: Exception) {
                showError(error)
            }
        }
    }

    private fun requireSalesPermission(user: JSONObject) {
        val permissions = user.optJSONArray("permissions")
        val allowed = user.optString("role") == "admin" ||
            (0 until (permissions?.length() ?: 0)).any { permissions?.optString(it) == "sales_visits.track" }
        if (!allowed) throw ApiException("This account does not have Sales Visits tracking permission.")
    }

    private fun showAuthenticatedUser(user: JSONObject) {
        currentUser = user
        loginPanel.visibility = View.GONE
        dutyPanel.visibility = View.VISIBLE
        val schedule = user.optJSONObject("officeSchedule")
        val scheduleText = if (schedule == null) {
            "No office schedule is configured. Ask your manager to set it in User & Access."
        } else {
            val days = schedule.optJSONArray("weekdays")
            val dayNames = (0 until (days?.length() ?: 0)).mapNotNull { index ->
                dayNames().getOrNull(days?.optInt(index) ?: -1)
            }.joinToString(", ")
            "Office hours: ${schedule.optString("startTime")}–${schedule.optString("endTime")} · $dayNames · ${schedule.optString("timezone")}"
        }
        statusText.text = "Signed in as ${user.optString("name")} · ${user.optString("email")}"
        dutyPanel.getChildAt(0).let { card ->
            if (card is LinearLayout && card.childCount > 1) (card.getChildAt(1) as? TextView)?.text = scheduleText
        }
    }

    private fun refreshSalesData() {
        if (loginPanel.visibility == View.VISIBLE) return
        executor.execute {
            try {
                val current = ApiClient.request("GET", "/api/sales-visits/current")
                val history = ApiClient.request("GET", "/api/sales-visits/history")
                val shift = current.optJSONObject("shift")
                currentShift = shift ?: JSONObject()
                val visitArray = history.optJSONArray("visits")
                visits = (0 until (visitArray?.length() ?: 0)).mapNotNull { visitArray?.optJSONObject(it) }
                activeVisit = visits.firstOrNull { visit ->
                    visit.optString("shift") == currentShift.optString("_id") &&
                        (visit.optJSONObject("checkOut")?.isNull("at") != false)
                }
                runOnUiThread {
                    current.optJSONObject("officeSchedule")?.let { currentUser.put("officeSchedule", it) }
                        ?: currentUser.remove("officeSchedule")
                    showAuthenticatedUser(currentUser)
                    renderShiftAndVisits()
                    if (currentShift.optBoolean("isActive")) {
                        startTrackingServiceIfPermitted()
                    } else {
                        stopTrackingService()
                    }
                }
            } catch (error: Exception) {
                showError(error)
            }
        }
    }

    private fun renderShiftAndVisits() {
        val shiftCard = dutyPanel.getChildAt(0) as? LinearLayout ?: return
        val status = shiftCard.getChildAt(3) as? TextView
        val active = currentShift.optBoolean("isActive")
        status?.text = if (active) {
            "On duty since ${formatDateTime(currentShift.optString("startedAt"))}. Keep the persistent notification visible."
        } else {
            "No active duty"
        }
        consentCheckBox.visibility = if (active) View.GONE else View.VISIBLE
        val start = shiftCard.getChildAt(5) as? LinearLayout
        val startButton = start?.getChildAt(0)
        startButton?.isEnabled = true
        (startButton as? Button)?.text = if (active) "Resume background tracking" else "Start duty"
        startButton?.alpha = 1f
        start?.getChildAt(1)?.isEnabled = currentShift.optBoolean("isActive") && activeVisit == null
        visitPhotoButton.isEnabled = activeVisit != null
        visitPhotoButton.text = if (activeVisit != null) "Take visit photo & check out" else "Check in to a visit to take its photo"
        visitRows.removeAllViews()
        if (visits.isEmpty()) {
            addText(visitRows, "No visits recorded yet.", 14f, color = 0xFF64748B.toInt(), top = 8)
            return
        }
        visits.forEach { visit ->
            val card = panel(visitRows)
            addText(card, visit.optString("placeName", "Visit"), 16f, bold = true, bottom = 4)
            val checkIn = visit.optJSONObject("checkIn")
            val checkOut = visit.optJSONObject("checkOut")
            addText(card, "In: ${formatDateTime(checkIn?.optString("at").orEmpty())}", 13f, color = 0xFF475569.toInt())
            addText(card, "Out: ${formatDateTime(checkOut?.optString("at").orEmpty())}", 13f, color = 0xFF475569.toInt())
            addText(card, "Duration: ${durationText(visit.optLong("durationSeconds", -1))}", 13f, color = 0xFF475569.toInt(), bottom = 4)
            val requirements = visit.optJSONArray("requirements")
            if (requirements != null && requirements.length() > 0) {
                addText(card, "Customer requirements", 14f, bold = true, bottom = 2)
                for (index in 0 until requirements.length()) {
                    val item = requirements.optJSONObject(index) ?: continue
                    val note = item.optString("note").takeIf(String::isNotBlank)?.let { " · $it" }.orEmpty()
                    addText(
                        card,
                        "${item.optString("productName")} (${item.optString("sku")}) · ${item.opt("quantity")} ${item.optString("unit")}$note",
                        13f,
                        color = 0xFF334155.toInt(),
                    )
                }
            }
            if (!visit.optString("evidenceFilename").isNullOrBlank()) {
                val photoButton = button("View visit photo")
                card.addView(photoButton)
                photoButton.setOnClickListener { showVisitPhoto(visit.optString("_id")) }
            }
        }
    }

    private fun startDuty() {
        readCurrentLocation { location ->
            val body = JSONObject()
                .put("consent", true)
                .put("location", locationJson(location))
            executeAction("Starting duty…") {
                val result = ApiClient.request("POST", "/api/sales-visits/shifts/start", body)
                result.getJSONObject("shift")
            }
        }
    }

    private fun endDuty() {
        readCurrentLocation { location ->
            executeAction("Ending duty…") {
                val result = ApiClient.request(
                    "POST",
                    "/api/sales-visits/shifts/end",
                    JSONObject().put("location", locationJson(location)),
                )
                result.getJSONObject("shift")
            }
        }
    }

    private fun searchRequirementProduct() {
        val searchInput = editText("Type product name or SKU (at least 2 characters)")
        val dialog = AlertDialog.Builder(this)
            .setTitle("Search active products")
            .setView(searchInput)
            .setPositiveButton("Search", null)
            .setNegativeButton("Cancel", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val query = searchInput.text.toString().trim()
                if (query.length < 2) {
                    showMessage("Enter at least 2 characters to search products.")
                    return@setOnClickListener
                }
                dialog.dismiss()
                val selectedProductIds = visitRequirements.map { it.productId }.toSet()
                setBusy("Searching active products…")
                executor.execute {
                    try {
                        val encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.name())
                        val response = ApiClient.request("GET", "/api/sales-visits/products?search=$encodedQuery&limit=30")
                        val products = response.optJSONArray("products")
                        val units = response.optJSONArray("units")
                        availableRequirementUnits = (0 until (units?.length() ?: 0)).mapNotNull { index ->
                            units?.optJSONObject(index)?.optString("name")?.takeIf(String::isNotBlank)
                        }
                        val available = (0 until (products?.length() ?: 0)).mapNotNull { index ->
                            products?.optJSONObject(index)?.takeIf { product ->
                                product.optString("id") !in selectedProductIds
                            }
                        }
                        runOnUiThread { showRequirementProductChoices(available) }
                    } catch (error: Exception) {
                        showError(error)
                    }
                }
            }
        }
        dialog.show()
    }

    private fun showRequirementProductChoices(products: List<JSONObject>) {
        if (products.isEmpty()) {
            showMessage("No matching active products found, or all matches are already added.")
            return
        }
        val labels = products.map { product ->
            "${product.optString("name")} · ${product.optString("sku")} (${product.optString("unit")})"
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Select a product")
            .setItems(labels) { _, index -> addVisitRequirement(products[index]) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun addVisitRequirement(product: JSONObject) {
        if (visitRequirements.size >= 50) {
            showMessage("A visit can include up to 50 product requirements.")
            return
        }
        val productId = product.optString("id")
        if (productId.isBlank() || visitRequirements.any { it.productId == productId }) {
            showMessage("This product is already in the visit requirements.")
            return
        }
        val row = panel(requirementRows)
        val productName = product.optString("name")
        val sku = product.optString("sku")
        val unit = product.optString("unit", "Unit")
        addText(row, "$productName · $sku", 15f, bold = true, bottom = 4)
        val quantity = editText("Required quantity ($unit)").apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        row.addView(quantity)
        val unitOptions = (availableRequirementUnits + unit).distinct()
        val unitAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, unitOptions).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        val unitInput = Spinner(this).apply {
            adapter = unitAdapter
            setSelection(unitOptions.indexOf(unit).coerceAtLeast(0))
        }
        row.addView(unitInput)
        val note = editText("Requirement note (optional)").apply { setSingleLine(false); minLines = 2; maxLines = 3 }
        row.addView(note)
        val removeButton = button("Remove requirement")
        row.addView(removeButton)
        val entry = VisitRequirementInput(productId, productName, quantity, unitInput, note)
        visitRequirements.add(entry)
        removeButton.setOnClickListener {
            visitRequirements.remove(entry)
            requirementRows.removeView(row)
        }
    }

    private fun checkIn() {
        val placeName = visitNameInput.text.toString().trim()
        val latitude = latitudeInput.text.toString().toDoubleOrNull()
        val longitude = longitudeInput.text.toString().toDoubleOrNull()
        if (placeName.isBlank() || latitude == null || longitude == null) {
            showMessage("Enter the visit location name and valid latitude/longitude.")
            return
        }
        val requirementArray = org.json.JSONArray()
        for (requirement in visitRequirements) {
            val quantity = requirement.quantityInput.text.toString().trim().toDoubleOrNull()
            if (quantity == null || quantity <= 0 || quantity > 1e12 || kotlin.math.abs(quantity * 1000 - kotlin.math.round(quantity * 1000)) >= 1e-6) {
                showMessage("Enter a valid quantity (up to 3 decimal places) for ${requirement.productName}.")
                return
            }
            requirementArray.put(
                JSONObject()
                    .put("productId", requirement.productId)
                    .put("quantity", quantity)
                    .put("unit", requirement.unitInput.selectedItem?.toString().orEmpty())
                    .put("note", requirement.noteInput.text.toString().trim()),
            )
        }
        readCurrentLocation { location ->
            val body = JSONObject()
                .put("placeName", placeName)
                .put("requirements", requirementArray)
                .put("geofence", JSONObject().put("latitude", latitude).put("longitude", longitude))
                .put("location", locationJson(location))
            executeAction("Checking in to visit…", onSuccess = {
                visitNameInput.setText("")
                visitRequirements.clear()
                requirementRows.removeAllViews()
            }) {
                ApiClient.request("POST", "/api/sales-visits/visits/check-in", body)
                JSONObject()
            }
        }
    }

    private fun captureVisitPhoto() {
        val visit = activeVisit
        if (visit == null) {
            showMessage("Check in to a visit before checking out.")
            return
        }
        val directory = File(cacheDir, "visit-photos").apply { mkdirs() }
        visitPhotoFile = File(directory, "visit-${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "$packageName.files", visitPhotoFile!!)
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri).apply {
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        requestingPhoto = true
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, REQUEST_CAMERA)
        } catch (_: Exception) {
            requestingPhoto = false
            showMessage("No camera app is available on this device.")
        }
    }

    @Deprecated("Required for the camera intent result.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CAMERA || !requestingPhoto) return
        requestingPhoto = false
        if (resultCode != RESULT_OK) {
            visitPhotoFile?.delete()
            visitPhotoFile = null
            return
        }
        val photo = visitPhotoFile
        val visit = activeVisit
        if (photo == null || visit == null) {
            showMessage("Photo or active visit is missing. Please try again.")
            return
        }
        readCurrentLocation { location ->
            setBusy("Saving visit photo and checking out…")
            executor.execute {
                try {
                    compressVisitPhoto(photo)
                    ApiClient.uploadVisitPhoto(visit.optString("_id"), locationJson(location), photo)
                    photo.delete()
                    visitPhotoFile = null
                    runOnUiThread {
                        showMessage("Visit photo saved and check-out completed.")
                        refreshSalesData()
                    }
                } catch (error: Exception) {
                    showError(error)
                }
            }
        }
    }

    private fun showVisitPhoto(visitId: String) {
        setBusy("Loading photo…")
        executor.execute {
            try {
                val bytes = ApiClient.downloadVisitPhoto(visitId)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    ?: throw ApiException("The saved visit photo could not be opened.")
                runOnUiThread {
                    val image = ImageView(this).apply {
                        setImageBitmap(bitmap)
                        adjustViewBounds = true
                        maxHeight = dp(480)
                    }
                    AlertDialog.Builder(this)
                        .setTitle("Visit photo proof")
                        .setView(image)
                        .setPositiveButton("Close", null)
                        .show()
                    statusText.text = "Signed in as ${currentUser.optString("name")}"
                }
            } catch (error: Exception) {
                showError(error)
            }
        }
    }

    private fun compressVisitPhoto(file: File) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        var sampleSize = 1
        while (bounds.outWidth / sampleSize > 1800 || bounds.outHeight / sampleSize > 1800) sampleSize *= 2
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, BitmapFactory.Options().apply { inSampleSize = sampleSize })
            ?: throw ApiException("The captured visit photo could not be opened.")
        val scaled = if (bitmap.width > 1600 || bitmap.height > 1600) {
            val ratio = minOf(1600f / bitmap.width, 1600f / bitmap.height)
            Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt(), (bitmap.height * ratio).toInt(), true)
        } else bitmap
        var quality = 88
        var compressed: ByteArrayOutputStream
        do {
            compressed = ByteArrayOutputStream()
            scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG, quality, compressed)
            quality -= 8
        } while (compressed.size() > 1_800_000 && quality > 40)
        if (scaled !== bitmap) bitmap.recycle()
        scaled.recycle()
        if (compressed.size() > 2 * 1024 * 1024) throw ApiException("This photo is too large to upload. Please take another photo.")
        file.writeBytes(compressed.toByteArray())
    }

    private fun ensureTrackingPermissions(action: () -> Unit) {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            pendingPermissionAction = action
            requestPermissions(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                REQUEST_LOCATION,
            )
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            AlertDialog.Builder(this)
                .setTitle("Allow location all the time")
                .setMessage("Android needs background location permission to keep duty updates running when the screen is locked. Location is sent only during an active, consented duty shift.")
                .setNegativeButton("Not now") { _, _ -> showMessage("Background tracking was not enabled.") }
                .setPositiveButton("Continue") { _, _ ->
                    pendingPermissionAction = action
                    requestPermissions(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), REQUEST_BACKGROUND_LOCATION)
                }
                .show()
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingPermissionAction = action
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        action()
    }

    @Deprecated("Required by the platform runtime permission API.")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val action = pendingPermissionAction ?: return
        val accepted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        pendingPermissionAction = null
        if (!accepted) {
            showMessage("Location and notification permissions are required for background duty tracking.")
            return
        }
        ensureTrackingPermissions(action)
    }

    private fun startTrackingServiceIfPermitted() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            statusText.text = "Duty is active on the server. Allow location permission to resume phone tracking."
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            statusText.text = "Duty is active. Tap Resume background tracking and allow location all the time."
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            statusText.text = "Duty is active. Tap Resume background tracking to allow the persistent notification."
            return
        }
        startServiceIntent(LocationTrackingService.ACTION_START)
    }

    private fun startServiceIntent(action: String) {
        val intent = Intent(this, LocationTrackingService::class.java).setAction(action)
        if (action == LocationTrackingService.ACTION_START && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopTrackingService() {
        stopServiceIntent()
    }

    private fun stopServiceIntent() {
        startServiceIntent(LocationTrackingService.ACTION_STOP)
    }

    private fun readCurrentLocation(onLocation: (Location) -> Unit) {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            ensureTrackingPermissions { readCurrentLocation(onLocation) }
            return
        }
        val manager = getSystemService(LOCATION_SERVICE) as LocationManager
        val provider = when {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> {
                showMessage("Turn on device location and try again.")
                return
            }
        }
        setBusy("Getting a precise GPS location…")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                manager.getCurrentLocation(provider, CancellationSignal(), java.util.concurrent.Executor { command -> runOnUiThread(command) }) { location ->
                    if (location == null) {
                        showMessage("Could not get a location fix. Move outdoors and try again.")
                    } else {
                        runOnUiThread { onLocation(location) }
                    }
                }
            } catch (error: SecurityException) {
                showError(error)
            }
        } else {
            val handler = android.os.Handler(mainLooper)
            var completed = false
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    if (completed) return
                    completed = true
                    runCatching { manager.removeUpdates(this) }
                    handler.removeCallbacksAndMessages(null)
                    onLocation(location)
                }
            }
            try {
                @Suppress("DEPRECATION")
                manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
                handler.postDelayed({
                    if (!completed) {
                        completed = true
                        runCatching { manager.removeUpdates(listener) }
                        showMessage("Could not get a location fix. Move outdoors and try again.")
                    }
                }, 20_000L)
            } catch (error: SecurityException) {
                showError(error)
            }
        }
    }

    private fun setLocationInputs(location: Location) {
        latitudeInput.setText("%.6f".format(java.util.Locale.US, location.latitude))
        longitudeInput.setText("%.6f".format(java.util.Locale.US, location.longitude))
        showMessage("Current GPS added as the visit pin.")
    }

    private fun locationJson(location: Location) = JSONObject()
        .put("latitude", location.latitude)
        .put("longitude", location.longitude)
        .put("accuracy", location.accuracy.toDouble().coerceAtLeast(0.0))

    private fun executeAction(message: String, onSuccess: () -> Unit = {}, action: () -> JSONObject) {
        setBusy(message)
        executor.execute {
            try {
                action()
                runOnUiThread {
                    onSuccess()
                    showMessage("Saved.")
                    refreshSalesData()
                }
            } catch (error: Exception) {
                showError(error)
            }
        }
    }

    private fun logout() {
        if (currentShift.optBoolean("isActive")) {
            showMessage("End duty before signing out, so location tracking is not interrupted.")
            return
        }
        executor.execute {
            runCatching { ApiClient.request("POST", "/api/auth/logout", JSONObject()) }
            ApiClient.clearSession()
            stopService(Intent(this, LocationTrackingService::class.java))
            runOnUiThread {
                currentUser = JSONObject()
                currentShift = JSONObject()
                activeVisit = null
                visits = emptyList()
                loginPanel.visibility = View.VISIBLE
                dutyPanel.visibility = View.GONE
                statusText.text = "Signed out."
            }
        }
    }

    private fun showError(error: Throwable) {
        runOnUiThread {
            statusText.text = error.message ?: "Unable to complete the request."
            statusText.setTextColor(0xFFB91C1C.toInt())
            Toast.makeText(this, statusText.text, Toast.LENGTH_LONG).show()
        }
    }

    private fun showMessage(message: String) {
        runOnUiThread {
            statusText.text = message
            statusText.setTextColor(0xFF475569.toInt())
        }
    }

    private fun setBusy(message: String) {
        runOnUiThread {
            statusText.text = message
            statusText.setTextColor(0xFF0F766E.toInt())
        }
    }

    private fun panel(parent: LinearLayout): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(12), dp(14), dp(14))
        setBackgroundColor(0xFFFFFFFF.toInt())
        val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        params.bottomMargin = dp(12)
        parent.addView(this, params)
    }

    private fun editText(hintText: String) = EditText(this).apply {
        hint = hintText
        textSize = 15f
        setSingleLine(true)
        setPadding(dp(12), dp(8), dp(12), dp(8))
        val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        params.bottomMargin = dp(8)
        layoutParams = params
    }

    private fun button(label: String) = Button(this).apply {
        text = label
        textSize = 14f
        isAllCaps = false
        val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        params.topMargin = dp(4)
        params.bottomMargin = dp(4)
        layoutParams = params
    }

    private fun addText(
        parent: LinearLayout,
        text: String,
        size: Float,
        bold: Boolean = false,
        color: Int = 0xFF0F172A.toInt(),
        top: Int = 0,
        bottom: Int = 0,
    ): TextView = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        params.topMargin = dp(top)
        params.bottomMargin = dp(bottom)
        parent.addView(this, params)
    }

    private fun weightedParams() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
        marginEnd = dp(6)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun formatDateTime(value: String): String {
        if (value.isBlank() || value == "null") return "—"
        return runCatching {
            DateTimeFormatter.ofPattern("MMM d, HH:mm")
                .withZone(ZoneId.systemDefault())
                .format(Instant.parse(value))
        }.getOrDefault(value)
    }

    private fun durationText(seconds: Long): String {
        if (seconds < 0) return "In progress"
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        return if (hours > 0) "${hours}h ${minutes}m" else "$minutes min"
    }

    private fun dayNames() = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_LOCATION = 5101
        private const val REQUEST_BACKGROUND_LOCATION = 5102
        private const val REQUEST_NOTIFICATIONS = 5103
        private const val REQUEST_CAMERA = 5104
    }
}
