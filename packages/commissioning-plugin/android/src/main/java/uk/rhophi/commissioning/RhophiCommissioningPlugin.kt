package uk.rhophi.commissioning

import android.Manifest
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import chip.devicecontroller.ChipClusters
import chip.devicecontroller.CommissionParameters
import chip.devicecontroller.NetworkCredentials
import chip.devicecontroller.OpenCommissioningCallback
import java.security.SecureRandom
import java.time.Instant
import java.util.Optional
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

@CapacitorPlugin(
    name = "RhophiCommissioning",
    permissions = [
        Permission(
            alias = "bluetooth",
            strings = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT],
        ),
        Permission(alias = "location", strings = [Manifest.permission.ACCESS_FINE_LOCATION]),
    ],
)
class RhophiCommissioningPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val keyStore by lazy { EphemeralKeyStore(context) }
    private val matter by lazy { MatterControllerHost(context) }
    private val ble by lazy { RhophiBleClient(context, matter.platform) }
    private val identities = mutableMapOf<String, RhophiWire.Identity>()
    private val preferences by lazy { context.getSharedPreferences("rhophi_matter_controller", 0) }

    @PluginMethod
    fun generateEphemeralKey(call: PluginCall) {
        val hint = call.getString("transactionHint")
        if (hint.isNullOrBlank()) return call.reject("transactionHint is required")
        runCatching { keyStore.create(hint) }
            .onSuccess { call.resolve(JSObject().put("publicKey", it).put("keyId", hint)) }
            .onFailure { call.reject("Unable to create commissioning key") }
    }

    @PluginMethod
    fun scanDevices(call: PluginCall) {
        if (hasBlePermission()) {
            scanDevicesGranted(call)
            return
        }
        val aliases = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf("bluetooth")
        } else {
            arrayOf("location")
        }
        requestPermissionForAliases(aliases, call, "scanPermissionsCallback")
    }

    @PermissionCallback
    private fun scanPermissionsCallback(call: PluginCall) {
        if (hasBlePermission()) scanDevicesGranted(call)
        else call.reject("Bluetooth permission is required")
    }

    private fun scanDevicesGranted(call: PluginCall) = launch(call) {
        identities.clear()
        val timeoutMs = (call.getInt("timeoutMs") ?: 10000).toLong()
        val devices = JSArray()
        for ((identity, result) in ble.scan(timeoutMs)) {
            identities[result.device.address] = identity
            devices.put(
                JSObject()
                    .put("address", result.device.address)
                    .put("claimId", Base64Url.encode(identity.claimId))
                    .put("productId", identity.productId)
                    .put("protocolVersion", identity.protocolVersion)
                    .put("flags", identity.flags)
                    .put("rssi", result.rssi),
            )
        }
        call.resolve(JSObject().put("devices", devices))
    }

    @PluginMethod
    fun identifyDevice(call: PluginCall) = launch(call) {
        requireBlePermission()
        val address = requiredString(call, "address")
        ble.connect(address).write(RhophiWire.identify, byteArrayOf())
        call.resolve()
    }

    @PluginMethod
    fun claimDevice(call: PluginCall) = launch(call) {
        requireBlePermission()
        val address = requiredString(call, "address")
        val challenge = Base64Url.decode(requiredString(call, "challenge"))
        require(challenge.size == 32) { "Challenge must be 32 bytes" }
        val session = ble.connect(address)
        val identity = RhophiWire.decodeIdentity(session.read(RhophiWire.identity))
        require(identity.protocolVersion == 1 && (identity.flags and 0x01) != 0) { "Device is not claimable" }
        val retainedNonce = identity.nonce.copyOf()
        try {
            session.write(RhophiWire.challenge, challenge)
            val proof = session.read(RhophiWire.response)
            require(proof.size == 32) { "Claim proof must be 32 bytes" }
            call.resolve(
                JSObject()
                    .put("deviceNonce", Base64Url.encode(retainedNonce))
                    .put("proof", Base64Url.encode(proof))
                    .put("claimId", Base64Url.encode(identity.claimId))
                    .put("productId", identity.productId),
            )
            proof.fill(0)
        } finally {
            challenge.fill(0)
            retainedNonce.fill(0)
        }
    }

    @PluginMethod
    fun commissionBle(call: PluginCall) = launch(call) {
        requireBlePermission()
        val address = requiredString(call, "address")
        val keyId = requiredString(call, "keyId")
        val grantObject = call.getObject("grant") ?: error("grant is required")
        val grant = EncryptedGrant(
            serverPublicKey = requiredString(grantObject, "serverEphemeralPublicKey"),
            nonce = requiredString(grantObject, "nonce"),
            ciphertext = requiredString(grantObject, "ciphertext"),
            authenticationTag = requiredString(grantObject, "authenticationTag"),
            transactionId = requiredString(grantObject, "transactionId"),
        )
        val expiresAt = Instant.parse(requiredString(grantObject, "expiresAt"))
        require(expiresAt.isAfter(Instant.now())) { "Commissioning grant expired" }
        val plaintext = GrantCrypto.decrypt(keyStore.load(keyId), grant)
        var dataset = ByteArray(0)
        try {
            val payload = JSONObject(plaintext.toString(Charsets.UTF_8))
            require(payload.getInt("version") == 1) { "Unsupported commissioning grant" }
            require(payload.getString("transaction_id") == grant.transactionId) { "Grant transaction mismatch" }
            require(Instant.parse(payload.getString("expires_at")).isAfter(Instant.now())) { "Commissioning grant expired" }
            val setupPasscode = payload.getLong("setup_passcode")
            dataset = Base64Url.decode(payload.getString("thread_operational_dataset"))
            val session = ble.connect(address)
            val nodeId = nextNodeId()
            var attestationVerified = false
            matter.enforceAttestation { accepted -> attestationVerified = accepted }
            val completion = CompletableDeferred<Long>()
            matter.controller.setCompletionListener(object : CompletionAdapter() {
                override fun onCommissioningStageStart(nodeId: Long, stage: String) {
                    progress(grant.transactionId, stage)
                }
                override fun onCommissioningComplete(nodeId: Long, errorCode: Long) {
                    if (errorCode == 0L && attestationVerified) completion.complete(nodeId)
                    else completion.completeExceptionally(IllegalStateException("Matter commissioning failed"))
                }
                override fun onError(error: Throwable) { completion.completeExceptionally(error) }
            })
            val network = NetworkCredentials.forThread(NetworkCredentials.ThreadCredentials(dataset))
            val parameters = CommissionParameters.Builder()
                .setCsrNonce(null)
                .setNetworkCredentials(network)
                .build()
            matter.controller.pairDeviceThroughBLE(
                session.gatt(),
                session.connectionId,
                nodeId,
                setupPasscode,
                parameters,
            )
            val commissionedNode = withTimeout(180000L) { completion.await() }
            keyStore.clear(keyId)
            call.resolve(
                JSObject()
                    .put("temporaryNodeId", commissionedNode.toULong().toString())
                    .put("attestationVerified", true),
            )
        } finally {
            plaintext.fill(0)
            dataset.fill(0)
        }
    }

    @PluginMethod
    fun openCommissioningWindow(call: PluginCall) = launch(call) {
        val nodeId = requiredString(call, "temporaryNodeId").toULong().toLong()
        val timeoutSeconds = (call.getInt("timeoutSeconds") ?: 900).coerceIn(60, 900)
        val discriminator = SecureRandom().nextInt(4096)
        val setupPasscode = generateSetupPasscode()
        val devicePointer = matter.connectedDevicePointer(nodeId)
        val result = CompletableDeferred<Unit>()
        try {
            matter.controller.openPairingWindowWithPINCallback(
                devicePointer,
                timeoutSeconds,
                1000L,
                discriminator,
                setupPasscode.toLong(),
                object : OpenCommissioningCallback {
                    override fun onError(status: Int, deviceId: Long) {
                        result.completeExceptionally(IllegalStateException("Enhanced window failed: $status"))
                    }
                    override fun onSuccess(deviceId: Long, manualPairingCode: String?, qrCode: String?) { result.complete(Unit) }
                },
            )
            withTimeout(30000L) { result.await() }
        } finally {
            matter.controller.releaseConnectedDevicePointer(devicePointer)
        }
        call.resolve(
            JSObject()
                .put("discriminator", discriminator)
                .put("setupPasscode", setupPasscode)
                .put("expiresAt", Instant.now().plusSeconds(timeoutSeconds.toLong()).toString()),
        )
    }

    @PluginMethod
    fun removeTemporaryFabric(call: PluginCall) = launch(call) {
        val nodeId = requiredString(call, "temporaryNodeId").toULong().toLong()
        val devicePointer = matter.connectedDevicePointer(nodeId)
        val result = CompletableDeferred<Unit>()
        try {
            ChipClusters.OperationalCredentialsCluster(devicePointer, 0).removeFabric(
                object : ChipClusters.OperationalCredentialsCluster.NOCResponseCallback {
                    override fun onSuccess(statusCode: Int, fabricIndex: Optional<Int>, debugText: Optional<String>) {
                        if (statusCode == 0) result.complete(Unit)
                        else result.completeExceptionally(IllegalStateException("RemoveFabric status $statusCode"))
                    }
                    override fun onError(error: Exception) { result.completeExceptionally(error) }
                },
                matter.controller.fabricIndex,
            )
            withTimeout(30000L) { result.await() }
        } finally {
            matter.controller.releaseConnectedDevicePointer(devicePointer)
        }
        call.resolve()
    }

    @PluginMethod
    fun cancel(call: PluginCall) = launch(call) {
        val transactionId = call.getString("transactionId")
        if (!transactionId.isNullOrBlank()) keyStore.clear(transactionId)
        ble.closeAll()
        call.resolve()
    }

    override fun handleOnDestroy() {
        ble.closeAll()
        matter.controller.close()
        super.handleOnDestroy()
    }

    private fun launch(call: PluginCall, block: suspend () -> Unit) {
        scope.launch {
            runCatching { block() }
                .onFailure { call.reject(it.message ?: "Commissioning failed") }
        }
    }

    private fun hasBlePermission(): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        getPermissionState("bluetooth") == PermissionState.GRANTED
    } else {
        getPermissionState("location") == PermissionState.GRANTED
    }

    private fun requireBlePermission() {
        if (!hasBlePermission()) error("Bluetooth permission is required")
    }

    private fun requiredString(call: PluginCall, name: String): String =
        call.getString(name)?.takeIf(String::isNotBlank) ?: error("$name is required")

    private fun requiredString(value: JSObject, name: String): String =
        value.getString(name)?.takeIf(String::isNotBlank) ?: error("$name is required")

    private fun nextNodeId(): Long {
        val next = preferences.getLong("next_node_id", 1L).coerceAtLeast(1L)
        preferences.edit().putLong("next_node_id", next + 1L).apply()
        return next
    }

    private fun progress(transactionId: String, state: String) {
        notifyListeners(
            "commissioningProgress",
            JSObject().put("transactionId", transactionId).put("state", state),
        )
    }

    private fun generateSetupPasscode(): Int {
        val invalid = setOf(11111111, 22222222, 33333333, 44444444, 55555555, 66666666, 77777777, 88888888, 12345678, 87654321)
        while (true) {
            val value = 1 + SecureRandom().nextInt(99_999_998)
            if (value !in invalid) return value
        }
    }
}
