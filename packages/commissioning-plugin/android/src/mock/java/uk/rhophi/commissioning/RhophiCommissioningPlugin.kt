package uk.rhophi.commissioning

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "RhophiCommissioning")
class RhophiCommissioningPlugin : Plugin() {
    private fun unavailable(call: PluginCall) {
        call.reject("Native Matter commissioning is unavailable in this mock-only review build")
    }

    @PluginMethod fun generateEphemeralKey(call: PluginCall) = unavailable(call)
    @PluginMethod fun scanDevices(call: PluginCall) = unavailable(call)
    @PluginMethod fun readIdentity(call: PluginCall) = unavailable(call)
    @PluginMethod fun identifyDevice(call: PluginCall) = unavailable(call)
    @PluginMethod fun claimDevice(call: PluginCall) = unavailable(call)
    @PluginMethod fun commissionBle(call: PluginCall) = unavailable(call)
    @PluginMethod fun openCommissioningWindow(call: PluginCall) = unavailable(call)
    @PluginMethod fun removeTemporaryFabric(call: PluginCall) = unavailable(call)
    @PluginMethod fun cancel(call: PluginCall) = call.resolve()
}
