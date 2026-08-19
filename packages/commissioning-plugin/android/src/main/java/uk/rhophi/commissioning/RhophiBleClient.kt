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

    suspend fun scan(timeoutMs: Long): List<ScanResult> {
        val scanner = adapter.bluetoothLeScanner ?: error("Bluetooth scanner unavailable")
        val results = ConcurrentHashMap<String, ScanResult>()
        val matterUuid = ParcelUuid(UUID.fromString("0000fff6-0000-1000-8000-00805f9b34fb"))
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val record = result.scanRecord ?: return
                val advertisesMatter = record.serviceUuids?.contains(matterUuid) == true ||
                    record.serviceData?.containsKey(matterUuid) == true
                if (advertisesMatter) results[result.device.address] = result
            }
        }

        scanner.startScan(emptyList(), ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), callback)
        try {
            delay(timeoutMs.coerceIn(1000L, 30000L))
        } finally {
            scanner.stopScan(callback)
        }
        return results.values.sortedByDescending(ScanResult::getRssi)
    }

    suspend fun readIdentity(address: String): RhophiWire.Identity {
        return try {
            RhophiWire.decodeIdentity(connect(address).read(RhophiWire.identity))
        } catch (first: IllegalStateException) {
            val stale = sessions[address]
            stale?.refreshGattCache()
            close(address)
            delay(500L)
            RhophiWire.decodeIdentity(connect(address).read(RhophiWire.identity))
        }
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
        
        try {
            withTimeout(15000L) { ready.await() }
        } catch (e: Exception) {
            session.close()
            sessions.remove(device.address)
            throw e
        }
        
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
        fun refreshGattCache() {
            runCatching { gatt.javaClass.getMethod("refresh").invoke(gatt) }
        }
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
            for (service in gatt.services) {
                android.util.Log.i("RhophiGatt", "service=${service.uuid}")
                for (characteristic in service.characteristics) {
                    android.util.Log.i("RhophiGatt", "characteristic=${characteristic.uuid} properties=${characteristic.properties}")
                }
            }
            if (status != BluetoothGatt.GATT_SUCCESS) {
                ready.completeExceptionally(IllegalStateException("GATT discovery failed"))
                return
            }
            if (gatt.getService(RhophiWire.service) == null) {
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
}