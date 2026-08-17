package uk.rhophi.commissioning

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import chip.platform.AndroidChipPlatform
import chip.platform.BleCallback
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout

@SuppressLint("MissingPermission")
internal class RhophiBleClient(
    private val context: Context,
    private val platform: AndroidChipPlatform,
) : BleCallback {
    private val adapter: BluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    private val sessions = ConcurrentHashMap<String, Session>()

    suspend fun scan(timeoutMs: Long): List<Pair<RhophiWire.Identity, ScanResult>> {
        val scanner = adapter.bluetoothLeScanner ?: error("Bluetooth scanner unavailable")
        val results = ConcurrentHashMap<String, ScanResult>()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                results[result.device.address] = result
            }
        }
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(MATTER_SERVICE)).build()
        scanner.startScan(listOf(filter), ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), callback)
        try {
            delay(timeoutMs.coerceIn(1000L, 30000L))
        } finally {
            scanner.stopScan(callback)
        }
        val discovered = mutableListOf<Pair<RhophiWire.Identity, ScanResult>>()
        for (result in results.values) {
            val session = runCatching { connect(result.device) }.getOrNull() ?: continue
            try {
                val identity = runCatching { RhophiWire.decodeIdentity(session.read(RhophiWire.identity)) }.getOrNull()
                if (identity != null && (identity.flags and 0x01) != 0) discovered += identity to result
            } finally {
                close(result.device.address)
            }
        }
        return discovered
    }

    suspend fun connect(address: String): Session {
        sessions[address]?.let { return it }
        val device = adapter.getRemoteDevice(address)
        return connect(device)
    }

    private suspend fun connect(device: BluetoothDevice): Session {
        val ready = CompletableDeferred<Unit>()
        lateinit var session: Session
        val callback = ForwardingGattCallback(platform, ready) { sessions.remove(device.address) }
        val gatt = device.connectGatt(context, false, callback)
        val connectionId = platform.bleManager.addConnection(gatt)
        platform.bleManager.setBleCallback(this)
        session = Session(gatt, connectionId, callback)
        sessions[device.address] = session
        callback.session = session
        withTimeout(15000L) { ready.await() }
        return session
    }

    fun close(address: String) {
        sessions.remove(address)?.close()
    }

    fun closeAll() {
        sessions.values.forEach(Session::close)
        sessions.clear()
    }

    override fun onCloseBleComplete(connId: Int) {
        sessions.entries.removeIf { (_, session) ->
            if (session.connectionId == connId) session.close()
            session.connectionId == connId
        }
    }

    override fun onNotifyChipConnectionClosed(connId: Int) = onCloseBleComplete(connId)

    internal class Session(
        private val gatt: BluetoothGatt,
        val connectionId: Int,
        private val callback: ForwardingGattCallback,
    ) {
        suspend fun read(uuid: UUID): ByteArray {
            val characteristic = characteristic(uuid)
            callback.readResult = CompletableDeferred()
            check(gatt.readCharacteristic(characteristic)) { "Unable to start GATT read" }
            return withTimeout(10000L) { callback.readResult!!.await() }
        }

        suspend fun write(uuid: UUID, value: ByteArray) {
            val characteristic = characteristic(uuid)
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            characteristic.value = value
            callback.writeResult = CompletableDeferred()
            check(gatt.writeCharacteristic(characteristic)) { "Unable to start GATT write" }
            withTimeout(10000L) { callback.writeResult!!.await() }
        }

        fun gatt(): BluetoothGatt = gatt
        fun close() { runCatching { gatt.disconnect() }; gatt.close() }

        private fun characteristic(uuid: UUID): BluetoothGattCharacteristic =
            gatt.getService(RhophiWire.service)?.getCharacteristic(uuid)
                ?: error("Rhophi GATT characteristic unavailable: $uuid")
    }

    internal class ForwardingGattCallback(
        private val platform: AndroidChipPlatform,
        private val ready: CompletableDeferred<Unit>,
        private val disconnected: () -> Unit,
    ) : BluetoothGattCallback() {
        lateinit var session: Session
        var readResult: CompletableDeferred<ByteArray>? = null
        var writeResult: CompletableDeferred<Unit>? = null
        private val chip get() = platform.bleManager.callback

        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            chip.onConnectionStateChange(gatt, status, newState)
            if (status != BluetoothGatt.GATT_SUCCESS) ready.completeExceptionally(IllegalStateException("GATT connection failed: $status"))
            else if (newState == BluetoothProfile.STATE_CONNECTED) gatt.discoverServices()
            else if (newState == BluetoothProfile.STATE_DISCONNECTED) disconnected()
        }
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            chip.onServicesDiscovered(gatt, status)
            if (status != BluetoothGatt.GATT_SUCCESS || gatt.getService(RhophiWire.service) == null) {
                ready.completeExceptionally(IllegalStateException("Rhophi GATT service unavailable"))
            } else {
                gatt.requestMtu(247)
            }
        }
        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            chip.onMtuChanged(gatt, mtu, status)
            if (status == BluetoothGatt.GATT_SUCCESS) ready.complete(Unit)
            else ready.completeExceptionally(IllegalStateException("GATT MTU negotiation failed"))
        }
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            chip.onCharacteristicRead(gatt, characteristic, status)
            val result = readResult
            readResult = null
            if (status == BluetoothGatt.GATT_SUCCESS) result?.complete(characteristic.value.copyOf())
            else result?.completeExceptionally(IllegalStateException("GATT read failed: $status"))
        }
        override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            chip.onCharacteristicWrite(gatt, characteristic, status)
            val result = writeResult
            writeResult = null
            if (status == BluetoothGatt.GATT_SUCCESS) result?.complete(Unit)
            else result?.completeExceptionally(IllegalStateException("GATT write failed: $status"))
        }
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) = chip.onCharacteristicChanged(gatt, characteristic)
        override fun onDescriptorRead(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) = chip.onDescriptorRead(gatt, descriptor, status)
        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) = chip.onDescriptorWrite(gatt, descriptor, status)
    }

    companion object {
        private val MATTER_SERVICE: UUID = UUID.fromString("0000fff6-0000-1000-8000-00805f9b34fb")
    }
}
