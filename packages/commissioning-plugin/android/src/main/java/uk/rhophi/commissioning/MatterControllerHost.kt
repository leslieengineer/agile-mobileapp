package uk.rhophi.commissioning

import android.content.Context
import android.content.pm.ApplicationInfo
import chip.devicecontroller.AttestationInfo
import chip.devicecontroller.ChipDeviceController
import chip.devicecontroller.ControllerParams
import chip.devicecontroller.DeviceAttestationDelegate
import chip.devicecontroller.GetConnectedDeviceCallbackJni
import chip.devicecontroller.ICDDeviceInfo
import chip.platform.AndroidBleManager
import chip.platform.AndroidChipPlatform
import chip.platform.AndroidNfcCommissioningManager
import chip.platform.ChipMdnsCallbackImpl
import chip.platform.DiagnosticDataProviderImpl
import chip.platform.NsdManagerServiceBrowser
import chip.platform.NsdManagerServiceResolver
import chip.platform.PreferencesConfigurationManager
import chip.platform.PreferencesKeyValueStoreManager
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class MatterControllerHost(context: Context) {
    val platform: AndroidChipPlatform
    val controller: ChipDeviceController
    private val allowDevelopmentAttestation =
        context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    init {
        ChipDeviceController.loadJni()
        platform = AndroidChipPlatform(
            AndroidBleManager(context),
            AndroidNfcCommissioningManager(),
            PreferencesKeyValueStoreManager(context),
            PreferencesConfigurationManager(context),
            NsdManagerServiceResolver(context, NsdManagerServiceResolver.NsdManagerResolverAvailState()),
            NsdManagerServiceBrowser(context),
            ChipMdnsCallbackImpl(),
            DiagnosticDataProviderImpl(context),
        )
        controller = ChipDeviceController(
            ControllerParams.newBuilder()
                .setControllerVendorId(CONTROLLER_VENDOR_ID)
                .setEnableServerInteractions(true)
                .build(),
        )
    }

    suspend fun connectedDevicePointer(nodeId: Long): Long = suspendCancellableCoroutine { continuation ->
        controller.getConnectedDevicePointer(
            nodeId,
            object : GetConnectedDeviceCallbackJni.GetConnectedDeviceCallback {
                override fun onDeviceConnected(devicePointer: Long) = continuation.resume(devicePointer)
                override fun onConnectionFailure(nodeId: Long, error: Exception) = continuation.resumeWithException(error)
            },
        )
    }

    fun enforceAttestation(onResult: (Boolean) -> Unit) {
        controller.setDeviceAttestationDelegate(
            30,
            DeviceAttestationDelegate { devicePtr: Long, _: AttestationInfo, errorCode: Long ->
                val accepted = errorCode == 0L || allowDevelopmentAttestation
                onResult(accepted)
                controller.continueCommissioning(devicePtr, accepted)
            },
        )
    }

    companion object {
        // Replace with the product's assigned commissioner VID before production release.
        private const val CONTROLLER_VENDOR_ID = 0xFFF4
    }
}

internal open class CompletionAdapter : ChipDeviceController.CompletionListener {
    override fun onConnectDeviceComplete() = Unit
    override fun onStatusUpdate(status: Int) = Unit
    override fun onPairingComplete(errorCode: Long) = Unit
    override fun onPairingDeleted(errorCode: Long) = Unit
    override fun onCommissioningComplete(nodeId: Long, errorCode: Long) = Unit
    override fun onReadCommissioningInfo(vendorId: Int, productId: Int, wifiEndpointId: Int, threadEndpointId: Int) = Unit
    override fun onCommissioningStatusUpdate(nodeId: Long, stage: String, errorCode: Long) = Unit
    override fun onCommissioningStageStart(nodeId: Long, stage: String) = Unit
    override fun onNotifyChipConnectionClosed() = Unit
    override fun onCloseBleComplete() = Unit
    override fun onError(error: Throwable) = Unit
    override fun onOpCSRGenerationComplete(csr: ByteArray) = Unit
    override fun onICDRegistrationInfoRequired() = Unit
    override fun onICDRegistrationComplete(errorCode: Long, icdDeviceInfo: ICDDeviceInfo) = Unit
}
